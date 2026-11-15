import { getPreferenceValues } from "@raycast/api";

import { createClient, type OrbitClient } from "./client";
import type { Scope } from "./types";

let cached: { key: string; client: OrbitClient } | undefined;

/** The API client for the current preferences. Throws an `OrbitError` for an invalid URL. */
export function getClient(): OrbitClient {
  const { instanceUrl, apiToken } = getPreferenceValues<Preferences>();
  const key = `${instanceUrl}\n${apiToken}`;
  if (cached?.key !== key) cached = { key, client: createClient({ instanceUrl, apiToken }) };
  return cached.client;
}

/** Write scopes include their read scope. */
export function scopeChecker(scopes: Scope[]): (scope: Scope) => boolean {
  const granted = new Set(scopes);
  return (scope) =>
    granted.has(scope) ||
    (scope === "tasks:read" && granted.has("tasks:write")) ||
    (scope === "docs:read" && granted.has("docs:write"));
}
