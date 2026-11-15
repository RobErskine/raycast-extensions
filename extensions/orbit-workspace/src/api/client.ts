import { allPages } from "./pagination";
import { OrbitError, parseProblem } from "./problem";
import type {
  Comment,
  Conversation,
  Doc,
  DocPatch,
  DocSummary,
  Label,
  Me,
  Member,
  MessagePage,
  NewDoc,
  NewTask,
  Page,
  Project,
  SearchPage,
  Status,
  Task,
  TaskPatch,
  TaskQuery,
  ThreadPage,
} from "./types";
import { buildUrl, normalizeInstanceUrl, type QueryValue } from "./url";

const PAGE_LIMIT = 100;
/** A request that takes longer fails, so a hung server cannot keep a spinner (or the menu bar) busy. */
const TIMEOUT_MS = 20_000;
const MCP_PROTOCOL_VERSION = "2025-11-25";

export interface ClientOptions {
  instanceUrl: string;
  apiToken: string;
  fetch?: typeof fetch;
}

type RequestOptions = { query?: Record<string, QueryValue>; body?: unknown };

export type OrbitClient = ReturnType<typeof createClient>;

export function createClient(options: ClientOptions) {
  const base = normalizeInstanceUrl(options.instanceUrl);
  const token = options.apiToken.trim();
  const doFetch = options.fetch ?? fetch;
  const host = new URL(base).host;

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new OrbitError({ status: 0, code: "network", detail: `${host} did not answer within 20 seconds.` });
      }
      const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
      throw new OrbitError({ status: 0, code: "network", detail: `Could not reach ${host}${cause}.` });
    }
  }

  async function request<T>(method: string, path: string, { query, body }: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await send(buildUrl(`${base}/api/public/v1`, path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw await parseProblem(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Calls a tool of Orbit's MCP endpoint. Chat is only available there. */
  async function callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await send(`${base}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    });
    return readToolResponse<T>(response, host);
  }

  let me: Promise<Me> | undefined;
  const ws = async () => {
    me ??= request<Me>("GET", "/me");
    const value = await me.catch((error) => {
      me = undefined;
      throw error;
    });
    return `/workspaces/${value.workspaces[0]?.id ?? value.workspace.id}`;
  };
  const task = (ref: string) => `/tasks/${encodeURIComponent(ref)}`;

  return {
    base,
    me: () => {
      me = request<Me>("GET", "/me");
      return me;
    },

    projects: async () => (await request<{ items: Project[] }>("GET", `${await ws()}/projects`)).items,
    statuses: async (projectId: string) => {
      const prefix = await ws();
      return allPages((cursor) =>
        request<Page<Status>>("GET", `${prefix}/projects/${projectId}/statuses`, {
          query: { cursor, limit: PAGE_LIMIT },
        }),
      );
    },
    labels: async (projectId: string) => {
      const prefix = await ws();
      return allPages((cursor) =>
        request<Page<Label>>("GET", `${prefix}/projects/${projectId}/labels`, { query: { cursor, limit: PAGE_LIMIT } }),
      );
    },
    members: async () => {
      const prefix = await ws();
      return allPages((cursor) =>
        request<Page<Member>>("GET", `${prefix}/members`, { query: { cursor, limit: PAGE_LIMIT } }),
      );
    },

    listTasks: async (query: TaskQuery) =>
      request<Page<Task>>("GET", `${await ws()}/tasks`, { query: { ...query } as Record<string, QueryValue> }),
    getTask: async (ref: string) => request<Task>("GET", `${await ws()}${task(ref)}`),
    createTask: async (body: NewTask) => request<Task>("POST", `${await ws()}/tasks`, { body }),
    updateTask: async (ref: string, body: TaskPatch) => request<Task>("PATCH", `${await ws()}${task(ref)}`, { body }),
    deleteTask: async (ref: string, version: number) =>
      request<void>("DELETE", `${await ws()}${task(ref)}`, { query: { expected_version: version } }),
    comments: async (ref: string) => {
      const prefix = await ws();
      return allPages((cursor) =>
        request<Page<Comment>>("GET", `${prefix}${task(ref)}/comments`, { query: { cursor, limit: PAGE_LIMIT } }),
      );
    },
    createComment: async (ref: string, body: string) =>
      request<Comment>("POST", `${await ws()}${task(ref)}/comments`, { body: { body } }),

    listDocs: async () => (await request<Page<DocSummary>>("GET", `${await ws()}/docs`)).items,
    getDoc: async (id: string) => request<Doc>("GET", `${await ws()}/docs/${id}`),
    createDoc: async (body: NewDoc) => request<Doc>("POST", `${await ws()}/docs`, { body }),
    updateDoc: async (id: string, body: DocPatch) => request<Doc>("PATCH", `${await ws()}/docs/${id}`, { body }),

    conversations: async () => (await callTool<{ items: Conversation[] }>("list_conversations")).items,
    messages: (conversationId: string, before?: string, limit = 50) =>
      callTool<MessagePage>("list_messages", { conversation_id: conversationId, before, limit }),
    thread: (messageId: string, before?: string, limit = 50) =>
      callTool<ThreadPage>("get_thread", { message_id: messageId, before, limit }),
    searchMessages: (query: string, conversationId?: string, cursor?: string) =>
      callTool<SearchPage>("search_messages", { query, conversation_id: conversationId, cursor }),
  };
}

interface JsonRpcResponse {
  error?: { code: number; message: string };
  result?: { isError?: boolean; content?: { type: string; text?: string }[]; structuredContent?: unknown };
}

/** Maps an MCP `tools/call` response to its result, or to an `OrbitError`. */
export async function readToolResponse<T>(response: Response, host: string): Promise<T> {
  if (response.status === 401) {
    throw new OrbitError({ status: 401, code: "unauthorized", detail: "Orbit did not accept the API token." });
  }
  if (response.status === 429) throw await parseProblem(response);
  if (!response.ok) {
    throw new OrbitError({
      status: response.status,
      code: "mcp_unavailable",
      detail: `Orbit chat is not reachable at ${host} (status ${response.status}). Use the same address as the server's public origin (ORBIT_PUBLIC_ORIGIN).`,
    });
  }
  let payload: JsonRpcResponse;
  try {
    payload = (await response.json()) as JsonRpcResponse;
  } catch {
    throw new OrbitError({ status: 502, code: "mcp_invalid", detail: "Orbit sent a chat response that is not JSON." });
  }
  if (payload.error) {
    if (/lacks the required permission/i.test(payload.error.message)) {
      throw new OrbitError({
        status: 403,
        code: "insufficient_scope",
        detail: "The API token does not have the Chat: Read permission.",
      });
    }
    throw new OrbitError({ status: 400, code: "mcp_error", detail: payload.error.message });
  }
  const result = payload.result;
  if (!result || result.isError) {
    const text = result?.content?.find((block) => block.type === "text")?.text;
    throw new OrbitError({ status: 404, code: "mcp_refused", detail: text || "Orbit refused the chat request." });
  }
  return result.structuredContent as T;
}
