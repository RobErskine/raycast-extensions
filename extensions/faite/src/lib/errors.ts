/**
 * Maps Faite's `{ error: "..." }` bodies to something a person can act on.
 *
 * **Imports nothing**, for the same reason `dates.ts` does not — see that
 * file's header. This is the half of `api.ts` worth testing, and it should
 * not need Raycast's runtime to reach.
 */

export class FaiteError extends Error {
  // Declared and assigned longhand rather than as a constructor parameter
  // property: Node's strip-only TypeScript mode, which `npm test` uses to run
  // this file directly, does not support that syntax.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FaiteError";
    this.status = status;
  }
}

/**
 * `insufficient-scope` is called out specifically because it is the single
 * most likely misconfiguration: a key minted without ticking Write reads fine
 * and fails on the first edit, which without this reads as a mysterious 403
 * rather than "you need a different key".
 */
export function messageFor(status: number, error: string | undefined): string {
  switch (error) {
    case "unauthenticated":
      return "Faite rejected the API key. Reconnect your account, or check the key in preferences.";
    case "insufficient-scope":
      return "This API key is read-only. Mint one with Write enabled in Faite \u2192 Settings \u2192 API Keys.";
    case "invalid-request":
      return "Faite rejected the request as malformed.";
    case "not-found":
      return "That item no longer exists in Faite.";
    case "backlog-not-deletable":
      return "The Backlog list can't be deleted \u2014 it's where homeless to-dos go.";
    case "default-tab-not-deletable":
      return "The default tab can't be deleted \u2014 it's where rehomed lists go.";
    case "too-many-dependents":
      return "That has too many items attached to delete in one go. Move some out first.";
    default:
      return `Faite returned an unexpected error (${status}).`;
  }
}

/** Strips trailing slashes so `host/` + `/api/v1` cannot produce the double
 * slash that some proxies 404. */
export function normalizeHost(configured: string | undefined, fallback: string): string {
  return (configured?.trim() || fallback).replace(/\/+$/, "");
}
