import { getPreferenceValues } from "@raycast/api";
import { getAccessToken } from "@raycast/utils";

/**
 * A thin typed client over Faite's public API. No SDK, no code generation —
 * the surface is small enough that a hand-written client is easier to read
 * than a generated one, and `openapi/v1.json` on the server is the contract
 * either way.
 */

const DEFAULT_HOST = "https://myfaite.app";

/** Hidden behind a preference so a local worker can be pointed at without a
 * rebuild. Trailing slashes are stripped — `https://host/` + `/api/v1` would
 * otherwise produce a double slash that some proxies 404. */
export function apiHost(): string {
  const configured = getPreferenceValues<{ apiHost?: string }>().apiHost?.trim();
  return (configured || DEFAULT_HOST).replace(/\/+$/, "");
}

export class FaiteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FaiteError";
  }
}

/**
 * Maps the API's own error bodies to something a person can act on.
 *
 * `insufficient-scope` is called out specifically because it is the single
 * most likely misconfiguration: a key minted without ticking Write reads
 * fine and fails on the first edit, which without this reads as a mysterious
 * 403 rather than "you need a different key".
 */
function messageFor(status: number, error: string | undefined): string {
  switch (error) {
    case "unauthenticated":
      return "Faite rejected the API key. Reconnect your account, or check the key in preferences.";
    case "insufficient-scope":
      return "This API key is read-only. Mint one with Write enabled in Faite → Settings → API Keys.";
    case "invalid-request":
      return "Faite rejected the request as malformed.";
    case "not-found":
      return "That item no longer exists in Faite.";
    case "backlog-not-deletable":
      return "The Backlog list can't be deleted — it's where homeless to-dos go.";
    case "default-tab-not-deletable":
      return "The default tab can't be deleted — it's where rehomed lists go.";
    case "too-many-dependents":
      return "That has too many items attached to delete in one go. Move some out first.";
    default:
      return `Faite returned an unexpected error (${status}).`;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { token } = getAccessToken();

  const response = await fetch(`${apiHost()}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    // The body is the API's `{ error: "..." }` shape, but a proxy or a cold
    // worker can return HTML instead — never let that throw over the real
    // status code, which is the more useful thing to report.
    const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new FaiteError(messageFor(response.status, parsed?.error), response.status);
  }

  // 204 on DELETE. `response.json()` on an empty body throws.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: (path: string) => request<void>("DELETE", path),
};
