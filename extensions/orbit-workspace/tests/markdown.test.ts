import { describe, expect, it } from "vitest";

import { absoluteUrl, escapeMarkdown } from "../src/lib/markdown";

describe("escapeMarkdown", () => {
  it("shows Markdown characters as written", () => {
    expect(escapeMarkdown("Fix # in *bold* [link](x) ![img](y)")).toBe(
      "Fix \\# in \\*bold\\* \\[link\\]\\(x\\) \\!\\[img\\]\\(y\\)",
    );
    expect(escapeMarkdown("Plain title")).toBe("Plain title");
  });
});

describe("absoluteUrl", () => {
  it("keeps the base path prefix for same-origin paths", () => {
    expect(absoluteUrl("https://host/orbit", "/api/v1/files/1")).toBe("https://host/orbit/api/v1/files/1");
    expect(absoluteUrl("https://o.example", "api/v1/files/1")).toBe("https://o.example/api/v1/files/1");
    expect(absoluteUrl("https://o.example", "https://cdn.example/f")).toBe("https://cdn.example/f");
  });
});
