import { describe, expect, it } from "vitest";

import { isConflict, parseProblem } from "../src/api/problem";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...headers } });

describe("parseProblem", () => {
  it("reads a problem document", async () => {
    const error = await parseProblem(json(422, { code: "validation_failed", detail: "Unknown label.", status: 422 }));
    expect(error).toMatchObject({ status: 422, code: "validation_failed", detail: "Unknown label." });
  });

  it("reads the current version of a conflict", async () => {
    const error = await parseProblem(json(409, { code: "conflict", detail: "Changed.", conflict: { current_version: 7 } }));
    expect(error.currentVersion).toBe(7);
    expect(isConflict(error)).toBe(true);
  });

  it("reads Retry-After on 429", async () => {
    const error = await parseProblem(json(429, { code: "rate_limit_exceeded", detail: "Slow down." }, { "Retry-After": "12" }));
    expect(error.retryAfterSeconds).toBe(12);
  });

  it("makes an error from a body that is not JSON", async () => {
    const error = await parseProblem(new Response("Bad gateway", { status: 502 }));
    expect(error).toMatchObject({ status: 502, code: "http_error", detail: "Request failed with status 502." });
    const unauthorized = await parseProblem(new Response("", { status: 401 }));
    expect(unauthorized.code).toBe("unauthorized");
  });

  it("does not treat other 409 codes as a version conflict", async () => {
    expect(isConflict(await parseProblem(json(409, { code: "task_conflict", detail: "No." })))).toBe(false);
  });
});
