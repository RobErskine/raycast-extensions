import { isOrbitError } from "../api/problem";
import type { Label, Member, Project, Scope, Status } from "../api/types";
import { getClient, scopeChecker } from "../api/session";
import { errorMessage } from "../lib/errors";

import { ResolveError } from "./resolve";

const SCOPE_TITLE: Record<Scope, string> = {
  "tasks:read": "Tasks: Read",
  "tasks:write": "Tasks: Write",
  "docs:read": "Docs: Read",
  "docs:write": "Docs: Write",
  "chat:read": "Chat: Read",
};

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let value: Promise<T> | undefined;
  return () => (value ??= load());
}

/** What one tool call needs from Orbit. Each list loads at most once per call. */
export async function openOrbit(scope: Scope) {
  const client = getClient();
  const me = await client.me();
  const workspace = me.workspaces[0] ?? { ...me.workspace, scopes: me.token.scopes };
  if (!scopeChecker(workspace.scopes)(scope)) {
    throw new ResolveError(
      `The Orbit API token does not have ${SCOPE_TITLE[scope]}. The user can create a token with it in Orbit under Settings → API tokens.`,
    );
  }

  const projects = once(() => client.projects());
  const members = once((): Promise<Member[]> => client.members().catch(() => []));
  const statusCache = new Map<string, Promise<Status[]>>();
  const labelCache = new Map<string, Promise<Label[]>>();
  const statusesOf = (projectId: string) => {
    if (!statusCache.has(projectId)) statusCache.set(projectId, client.statuses(projectId));
    return statusCache.get(projectId)!;
  };
  const labelsOf = (projectId: string) => {
    if (!labelCache.has(projectId)) labelCache.set(projectId, client.labels(projectId));
    return labelCache.get(projectId)!;
  };

  return {
    client,
    base: client.base,
    workspaceId: workspace.id,
    userId: me.user?.id,
    projects,
    members,
    statusesOf,
    labelsOf,
    allStatuses: async () => (await Promise.all((await projects()).map((p) => statusesOf(p.id)))).flat(),
    allLabels: async () => (await Promise.all((await projects()).map((p) => labelsOf(p.id)))).flat(),
    /** Names for task output. */
    names: async () => {
      const [projectList, statusList, memberList] = await Promise.all([
        projects(),
        Promise.all((await projects()).map((p) => statusesOf(p.id))).then((lists) => lists.flat()),
        members(),
      ]);
      return {
        projects: new Map<string, Project>(projectList.map((p) => [p.id, p])),
        statuses: new Map<string, Status>(statusList.map((s) => [s.id, s])),
        members: new Map<string, string>(memberList.map((m) => [m.user_id, m.display_name])),
      };
    },
  };
}

export type OrbitContext = Awaited<ReturnType<typeof openOrbit>>;

/**
 * Runs a tool's work so that its errors reach the AI as one clear sentence (no stack, no token),
 * for example "No project matches "XYZ". Known: …".
 */
export async function withErrors<Output>(run: () => Promise<Output>): Promise<Output> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ResolveError) throw error;
    if (isOrbitError(error)) throw new Error(errorMessage(error));
    throw error;
  }
}
