import { useCachedPromise } from "@raycast/utils";
import { api, apiHost } from "./api";
import type { DayNote, Label, List, Profile, Tab, Todo } from "./types";

/**
 * Data hooks over the Faite API.
 *
 * `useCachedPromise` everywhere rather than `useFetch`: it caches across
 * launches, so a command opens showing last-known data instead of a spinner,
 * and it hands back `mutate` for optimistic writes. That matters more here
 * than usual — keys are rate-limited to 120 requests a minute, and a list
 * that refetched per keystroke would burn through that on one search.
 */

/** Lists, labels and tabs change rarely and are read by almost every view, so
 * they get a longer-lived cache than to-dos do. */
export function useLists() {
  return useCachedPromise(() => api.get<List[]>("/lists"), [], { keepPreviousData: true });
}

export function useLabels() {
  return useCachedPromise(() => api.get<Label[]>("/labels"), [], { keepPreviousData: true });
}

export function useTabs() {
  return useCachedPromise(() => api.get<Tab[]>("/tabs"), [], { keepPreviousData: true });
}

/**
 * The account's own settings — crucially `timezone`, without which "today"
 * is the laptop's guess rather than the user's actual day.
 */
export function useProfile() {
  return useCachedPromise(() => api.get<Profile>("/profile"), [], { keepPreviousData: true });
}

/**
 * To-dos, filtered server-side.
 *
 * The filters are passed as a query object rather than a prebuilt string so
 * the cache key is structural — two callers asking the same question share a
 * cache entry regardless of parameter order.
 */
export function useTodos(query: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (value === undefined ? [] : [[key, value] as [string, string]])),
  );
  const suffix = search.toString();

  return useCachedPromise((qs: string) => api.get<Todo[]>(`/todos${qs ? `?${qs}` : ""}`), [suffix], {
    keepPreviousData: true,
  });
}

/**
 * Overflow — to-dos that slipped past the account's Faite Loop window.
 *
 * Derived server-side against the account's own settings, never recomputed
 * here: the rule depends on `overflowAfterDays` and the board's own placement
 * logic, and a second implementation would drift the first time either
 * changed.
 *
 * Reports PLACEMENT, not visibility, so completed-but-overdue items come back
 * too. Callers that want a triage queue filter to `status === "open"`.
 */
export function useOverflow() {
  return useCachedPromise(() => api.get<Todo[]>("/overflow"), [], { keepPreviousData: true });
}

export function useBacklog() {
  return useCachedPromise(() => api.get<Todo[]>("/backlog"), [], { keepPreviousData: true });
}

export function useDayNote(date: string) {
  return useCachedPromise((d: string) => api.get<DayNote>(`/day-notes/${d}`), [date]);
}

/** `/board?todo=<id>` opens that to-do's sheet; `/board?day=<date>` opens the
 * day sheet. Both are real routes the app already handles. */
export function todoUrl(id: string): string {
  return `${apiHost()}/board?todo=${encodeURIComponent(id)}`;
}

export function dayUrl(date: string): string {
  return `${apiHost()}/board?day=${encodeURIComponent(date)}`;
}
