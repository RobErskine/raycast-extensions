import type { Message, MessagePage, Page, SearchPage } from "./types";

/** The page shape that `useCachedPromise` takes for paginated lists. */
export interface RaycastPage<T> {
  data: T[];
  hasMore: boolean;
  cursor?: string;
}

/** A REST list page (`{items, next_cursor}`). */
export function fromRestPage<T>(page: Page<T>): RaycastPage<T> {
  return { data: page.items, hasMore: page.next_cursor !== null, cursor: page.next_cursor ?? undefined };
}

/** A chat page comes oldest first; the list shows the newest message at the top. */
export function fromMessagePage(page: MessagePage): RaycastPage<Message> {
  return { data: [...page.items].reverse(), hasMore: page.before !== null, cursor: page.before ?? undefined };
}

export function fromSearchPage(page: SearchPage): RaycastPage<SearchPage["items"][number]> {
  return { data: page.items, hasMore: page.cursor !== null, cursor: page.cursor ?? undefined };
}

/**
 * One list page of the items that pass `keep`. It reads API pages from `cursor` on, until it has
 * `minItems` items, reaches the end, or has read `maxPages` pages. The next list page continues from
 * the returned cursor, so all pages of one list follow one cursor chain.
 */
export async function fillPage<T>(
  fetchPage: (cursor?: string) => Promise<Page<T>>,
  keep: (item: T) => boolean,
  cursor: string | undefined,
  minItems: number,
  maxPages: number,
): Promise<RaycastPage<T>> {
  const data: T[] = [];
  let next = cursor;
  for (let page = 0; page < maxPages && data.length < minItems; page++) {
    const result = await fetchPage(next);
    data.push(...result.items.filter(keep));
    next = result.next_cursor ?? undefined;
    if (!next) break;
  }
  return { data, hasMore: next !== undefined, cursor: next };
}

/** Reads every page of a short list (statuses, labels, members). */
export async function allPages<T>(fetchPage: (cursor?: string) => Promise<Page<T>>, maxPages = 20): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return items;
}
