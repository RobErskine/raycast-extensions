import { describe, expect, it } from "vitest";

import { OrbitError } from "../src/api/problem";
import { buildUrl, normalizeInstanceUrl } from "../src/api/url";

describe("normalizeInstanceUrl", () => {
  it("adds https and removes the trailing slash", () => {
    expect(normalizeInstanceUrl(" orbit.example.com/ ")).toBe("https://orbit.example.com");
  });

  it("keeps http, a port and a path prefix", () => {
    expect(normalizeInstanceUrl("http://127.0.0.1:18888")).toBe("http://127.0.0.1:18888");
    expect(normalizeInstanceUrl("https://example.com/orbit/")).toBe("https://example.com/orbit");
  });

  it("removes pasted API and app paths", () => {
    expect(normalizeInstanceUrl("https://orbit.example.com/api/public/v1/")).toBe("https://orbit.example.com");
    expect(normalizeInstanceUrl("https://orbit.example.com/mcp")).toBe("https://orbit.example.com");
    expect(normalizeInstanceUrl("https://orbit.example.com/tasks/SWY-12")).toBe("https://orbit.example.com");
    expect(normalizeInstanceUrl("https://example.com/orbit/docs/123")).toBe("https://example.com/orbit");
  });

  it("rejects text that is not an address", () => {
    expect(() => normalizeInstanceUrl("not a url")).toThrow(OrbitError);
    expect(() => normalizeInstanceUrl("ftp://orbit.example.com")).toThrow(/not a valid Orbit address/);
    expect(() => normalizeInstanceUrl("")).toThrow(OrbitError);
  });
});

describe("buildUrl", () => {
  it("skips empty query values", () => {
    expect(buildUrl("https://o.example", "/tasks", { q: "login", project_id: undefined, cursor: "", limit: 50 })).toBe(
      "https://o.example/tasks?q=login&limit=50",
    );
  });
});
