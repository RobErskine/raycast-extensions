import { OrbitError } from "./problem";

/** Web-app and API paths that people paste with the address by mistake. */
const PASTED_PATHS = /\/(api\/public\/v1|api\/v1|mcp|tasks|docs|chat|settings|profile|activity|login)(\/.*)?$/i;

/**
 * Turns the "Orbit URL" preference into a base URL without a trailing slash, for example
 * `orbit.example.com/tasks/` → `https://orbit.example.com`. A path prefix (Orbit behind a
 * reverse proxy at `/orbit`) is kept.
 */
export function normalizeInstanceUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw invalidUrl(raw);
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) throw invalidUrl(raw);
  const path = url.pathname.replace(/\/+$/, "").replace(PASTED_PATHS, "").replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

function invalidUrl(raw: string): OrbitError {
  return new OrbitError({
    status: 0,
    code: "invalid_url",
    detail: `"${raw.trim()}" is not a valid Orbit address. Use the address you open Orbit at, for example https://orbit.example.com.`,
  });
}

export type QueryValue = string | number | boolean | undefined | null;

/** Builds `base + path` with the query parameters that have a value. */
export function buildUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export const webUrls = {
  doc: (base: string, workspaceId: string, docId: string) =>
    buildUrl(base, `/docs/${docId}`, { workspace: workspaceId }),
  conversation: (base: string, conversationId: string) => `${base}/chat/${conversationId}`,
  thread: (base: string, conversationId: string, messageId: string) =>
    `${base}/chat/${conversationId}/thread/${messageId}`,
  apiTokens: (base: string) => `${base}/settings/api-tokens`,
};
