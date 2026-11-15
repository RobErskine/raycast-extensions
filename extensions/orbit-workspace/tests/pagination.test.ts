import { describe, expect, it } from "vitest";

import { allPages, fillPage, fromMessagePage, fromRestPage, fromSearchPage } from "../src/api/pagination";
import type { Message } from "../src/api/types";

const message = (id: string) => ({ id }) as Message;

describe("page mapping", () => {
  it("maps a REST page", () => {
    expect(fromRestPage({ items: [1, 2], next_cursor: "c2" })).toEqual({ data: [1, 2], hasMore: true, cursor: "c2" });
    expect(fromRestPage({ items: [3], next_cursor: null })).toEqual({ data: [3], hasMore: false, cursor: undefined });
  });

  it("shows chat messages newest first and pages with `before`", () => {
    const page = fromMessagePage({ items: [message("a"), message("b")], before: "a", after: null });
    expect(page.data.map((m) => m.id)).toEqual(["b", "a"]);
    expect(page).toMatchObject({ hasMore: true, cursor: "a" });
    expect(fromMessagePage({ items: [], before: null, after: null }).hasMore).toBe(false);
  });

  it("maps a search page", () => {
    const hit = { message: message("m"), conversation_id: "c" };
    expect(fromSearchPage({ items: [hit], cursor: null })).toEqual({ data: [hit], hasMore: false, cursor: undefined });
  });

  it("reads every page of a short list", async () => {
    const pages: Record<string, { items: number[]; next_cursor: string | null }> = {
      start: { items: [1, 2], next_cursor: "p2" },
      p2: { items: [3], next_cursor: null },
    };
    const seen: (string | undefined)[] = [];
    const items = await allPages(async (cursor) => {
      seen.push(cursor);
      return pages[cursor ?? "start"];
    });
    expect(items).toEqual([1, 2, 3]);
    expect(seen).toEqual([undefined, "p2"]);
  });
});

describe("fillPage", () => {
  // Pages of numbers: p0 = 1..4, p1 = 5..8, p2 = 9..10 (last).
  const pages: Record<string, { items: number[]; next_cursor: string | null }> = {
    p0: { items: [1, 2, 3, 4], next_cursor: "p1" },
    p1: { items: [5, 6, 7, 8], next_cursor: "p2" },
    p2: { items: [9, 10], next_cursor: null },
  };
  const fetchPage = async (cursor?: string) => pages[cursor ?? "p0"];
  const even = (n: number) => n % 2 === 0;

  it("reads pages until it has enough matching items, and returns the next cursor", async () => {
    expect(await fillPage(fetchPage, even, undefined, 3, 10)).toEqual({ data: [2, 4, 6, 8], hasMore: true, cursor: "p2" });
  });

  it("continues from the cursor it is given, never from the first page", async () => {
    expect(await fillPage(fetchPage, even, "p2", 3, 10)).toEqual({ data: [10], hasMore: false, cursor: undefined });
  });

  it("stops at the page limit", async () => {
    expect(await fillPage(fetchPage, () => false, undefined, 3, 2)).toEqual({ data: [], hasMore: true, cursor: "p2" });
  });
});
