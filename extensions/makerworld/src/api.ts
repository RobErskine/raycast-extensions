import { Design } from "./types";

export const MAKERWORLD_BASE = "https://makerworld.com";
export const PAGE_SIZE = 20;

export function buildSearchUrl(keyword: string, page: number): string {
  const params = new URLSearchParams({
    orderBy: "score",
    designType: "0",
    isFromSearchList: "false",
    keyword,
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  return `${MAKERWORLD_BASE}/api/v1/search-service/select/design2?${params}`;
}

export function buildModelUrl(design: Design): string {
  return `${MAKERWORLD_BASE}/en/models/${design.id}-${design.slug}`;
}

export function buildCreatorUrl(handle: string): string {
  return `${MAKERWORLD_BASE}/en/@${handle}`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}
