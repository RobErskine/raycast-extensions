import { describe, expect, it, vi } from "vitest";

import { createClient, readToolResponse } from "../src/api/client";
import { OrbitError } from "../src/api/problem";
import type { Status, Task } from "../src/api/types";
import { absoluteDocLinks, appendMarkdown, breadcrumb } from "../src/lib/docs";
import { withVersionRetry } from "../src/lib/retry";
import { compareByUrgency, defaultStatus, doneStatus, isDueWithin } from "../src/lib/tasks";

const status = (id: string, category: Status["category"], position: number): Status => ({
  id,
  project_id: "p",
  name: id,
  description: "",
  color: "",
  category,
  position,
});

const task = (overrides: Partial<Task>): Task =>
  ({ priority: "none", due_at: null, updated_at: "2026-11-01T00:00:00.000Z", ...overrides }) as Task;

describe("statuses", () => {
  const statuses = [status("done", "completed", 3), status("todo", "unstarted", 1), status("backlog", "unstarted", 0)];
  it("picks the first unstarted and the first completed status by position", () => {
    expect(defaultStatus(statuses)?.id).toBe("backlog");
    expect(doneStatus(statuses)?.id).toBe("done");
    expect(doneStatus([status("todo", "unstarted", 0)])).toBeUndefined();
  });
});

describe("compareByUrgency", () => {
  it("sorts by priority, then due date, then last update", () => {
    const tasks = [
      task({ id: "low", priority: "low" }),
      task({ id: "high-late", priority: "high", due_at: "2026-12-01T00:00:00.000Z" }),
      task({ id: "high-soon", priority: "high", due_at: "2026-11-11T00:00:00.000Z" }),
      task({ id: "urgent", priority: "urgent" }),
    ];
    expect(tasks.sort(compareByUrgency).map((t) => t.id)).toEqual(["urgent", "high-soon", "high-late", "low"]);
  });

  it("finds tasks due within a week, overdue included", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    expect(isDueWithin(task({ due_at: "2026-11-01T00:00:00.000Z" }), 7, now)).toBe(true);
    expect(isDueWithin(task({ due_at: "2026-11-30T00:00:00.000Z" }), 7, now)).toBe(false);
    expect(isDueWithin(task({}), 7, now)).toBe(false);
  });
});

describe("withVersionRetry", () => {
  const conflict = new OrbitError({ status: 409, code: "conflict", detail: "Changed." });

  it("reads again and writes once more after a version conflict", async () => {
    const write = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce("ok");
    const read = vi.fn().mockResolvedValue({ version: 2 });
    await expect(withVersionRetry({ version: 1 }, read, write)).resolves.toBe("ok");
    expect(write.mock.calls.map(([record]) => record.version)).toEqual([1, 2]);
  });

  it("reports a second conflict and other errors", async () => {
    const read = vi.fn().mockResolvedValue({ version: 2 });
    await expect(withVersionRetry({ version: 1 }, read, vi.fn().mockRejectedValue(conflict))).rejects.toBe(conflict);
    const other = new OrbitError({ status: 422, code: "validation_failed", detail: "No." });
    await expect(withVersionRetry({ version: 1 }, read, vi.fn().mockRejectedValue(other))).rejects.toBe(other);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("docs", () => {
  it("builds the parent path and stops on cycles", () => {
    const docs = new Map([
      ["a", { id: "a", parent_id: null, title: "Handbook" }],
      ["b", { id: "b", parent_id: "a", title: "" }],
      ["c", { id: "c", parent_id: "b", title: "Deploys" }],
      ["x", { id: "x", parent_id: "y", title: "X" }],
      ["y", { id: "y", parent_id: "x", title: "Y" }],
    ] as never);
    expect(breadcrumb(docs.get("c")!, docs)).toBe("Handbook › Untitled");
    expect(breadcrumb(docs.get("x")!, docs)).toBe("Y");
  });

  it("makes doc links absolute and appends blocks", () => {
    const id = "0193f1d2-0000-7000-8000-000000000001";
    expect(absoluteDocLinks(`See [Plan](/docs/${id}).`, "https://o.example", "ws1")).toBe(
      `See [Plan](https://o.example/docs/${id}?workspace=ws1).`,
    );
    expect(appendMarkdown("# Notes\n\n", " - new item ")).toBe("# Notes\n\n- new item\n");
    expect(appendMarkdown("", "first")).toBe("first\n");
  });
});

describe("API client", () => {
  const me = { workspace: { id: "ws1" }, workspaces: [{ id: "ws1", scopes: ["tasks:read"] }] };

  it("sends the token and the workspace path, and maps problems", async () => {
    const calls: Request[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(new Request(url, init));
      if (url.endsWith("/me")) return Response.json(me);
      return new Response(JSON.stringify({ code: "not_found", detail: "Gone." }), { status: 404 });
    });
    const client = createClient({ instanceUrl: "orbit.example.com/", apiToken: " orb_x ", fetch: fetchMock as never });
    await expect(client.getTask("SWY-12")).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(calls[1].url).toBe("https://orbit.example.com/api/public/v1/workspaces/ws1/tasks/SWY-12");
    expect(calls[1].headers.get("authorization")).toBe("Bearer orb_x");
  });

  it("reports a network failure with the host", async () => {
    const client = createClient({
      instanceUrl: "https://orbit.example.com",
      apiToken: "orb_x",
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as never,
    });
    await expect(client.me()).rejects.toMatchObject({ code: "network", detail: "Could not reach orbit.example.com." });
  });
});

describe("readToolResponse", () => {
  const rpc = (body: unknown) => Response.json(body);

  it("returns structured content", async () => {
    await expect(
      readToolResponse(rpc({ result: { structuredContent: { items: [1] }, content: [] } }), "h"),
    ).resolves.toEqual({ items: [1] });
  });

  it("maps a missing permission, a refusal and a bad token", async () => {
    await expect(
      readToolResponse(rpc({ error: { code: -32602, message: "Connection lacks the required permission" } }), "h"),
    ).rejects.toMatchObject({ code: "insufficient_scope", status: 403 });
    await expect(
      readToolResponse(rpc({ result: { isError: true, content: [{ type: "text", text: "Resource is not available" }] } }), "h"),
    ).rejects.toMatchObject({ code: "mcp_refused", detail: "Resource is not available" });
    await expect(readToolResponse(new Response("", { status: 401 }), "h")).rejects.toMatchObject({ status: 401 });
    await expect(readToolResponse(new Response("", { status: 403 }), "h")).rejects.toMatchObject({
      code: "mcp_unavailable",
    });
  });
});
