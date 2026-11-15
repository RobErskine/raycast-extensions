import { describe, expect, it } from "vitest";

import type { Status, Task } from "../src/api/types";
import {
  describeView,
  EMPTY_FILTER,
  matchesState,
  moveView,
  parseView,
  parseViews,
  viewQuery,
  type TaskView,
} from "../src/lib/views";

const statuses = new Map<string, Status>([
  ["todo", { id: "todo", category: "unstarted" } as Status],
  ["done", { id: "done", category: "completed" } as Status],
]);
const task = (status_id: string) => ({ status_id }) as Task;

describe("viewQuery", () => {
  it("maps a view to API parameters", () => {
    const filter = { ...EMPTY_FILTER, projectId: "p1", assignee: "me", priority: "high" as const, labelId: "l1" };
    expect(viewQuery(filter, "u1")).toEqual({
      project_id: "p1",
      status_id: undefined,
      assignee_id: "u1",
      priority: "high",
      label_id: "l1",
      q: undefined,
      sort: "updated_at",
      order: "desc",
    });
  });

  it("lets typed text replace the view's text, and sorts due dates soonest first", () => {
    const filter = { ...EMPTY_FILTER, query: "release", sort: "due_date" as const };
    expect(viewQuery(filter, "u1")).toMatchObject({ q: "release", order: "asc" });
    expect(viewQuery(filter, "u1", " login ")).toMatchObject({ q: "login" });
  });

  it("keeps 'none' and drops 'me' without a person (service-account token)", () => {
    expect(viewQuery({ ...EMPTY_FILTER, assignee: "none" }, undefined).assignee_id).toBe("none");
    expect(viewQuery({ ...EMPTY_FILTER, assignee: "me" }, undefined).assignee_id).toBeUndefined();
  });
});

describe("matchesState", () => {
  it("filters open and done tasks unless a status is chosen", () => {
    expect(matchesState(task("todo"), { ...EMPTY_FILTER, state: "open" }, statuses)).toBe(true);
    expect(matchesState(task("done"), { ...EMPTY_FILTER, state: "open" }, statuses)).toBe(false);
    expect(matchesState(task("done"), { ...EMPTY_FILTER, state: "done" }, statuses)).toBe(true);
    expect(matchesState(task("done"), { ...EMPTY_FILTER, state: "all" }, statuses)).toBe(true);
    expect(matchesState(task("done"), { ...EMPTY_FILTER, state: "open", statusId: "done" }, statuses)).toBe(true);
  });
});

describe("describeView", () => {
  it("names the filters", () => {
    const names = {
      projects: new Map([["p1", "DBM"]]),
      statuses: new Map(),
      members: new Map([["u2", "Ana"]]),
      labels: new Map([["l1", "Bug"]]),
    };
    expect(
      describeView({ ...EMPTY_FILTER, projectId: "p1", assignee: "u2", priority: "urgent", labelId: "l1", query: "ui" }, names),
    ).toBe('DBM · Open · Assigned to Ana · Urgent · Bug · "ui"');
    expect(describeView({ ...EMPTY_FILTER, state: "all", assignee: "me" }, names)).toBe("All projects · Assigned to me");
  });
});

describe("parseView", () => {
  it("accepts a stored view and repairs unknown values", () => {
    const view = parseView({ id: "v1", name: " DBM ", filter: { projectId: "p1", state: "weird", sort: 3, priority: "high" } });
    expect(view).toEqual({
      id: "v1",
      name: "DBM",
      filter: { ...EMPTY_FILTER, projectId: "p1", priority: "high" },
    });
  });

  it("rejects values without an id or a name", () => {
    expect(parseView({ name: "x" })).toBeUndefined();
    expect(parseView({ id: "v", name: "  " })).toBeUndefined();
    expect(parseView("x")).toBeUndefined();
    expect(parseViews([{ id: "a", name: "A" }, null, 4])).toHaveLength(1);
    expect(parseViews({})).toEqual([]);
  });
});

describe("moveView", () => {
  const views = ["a", "b", "c"].map((id) => ({ id, name: id, filter: EMPTY_FILTER }) as TaskView);
  it("moves within bounds only", () => {
    expect(moveView(views, 0, 1).map((v) => v.id)).toEqual(["b", "a", "c"]);
    expect(moveView(views, 2, -2).map((v) => v.id)).toEqual(["c", "a", "b"]);
    expect(moveView(views, 0, -1)).toBe(views);
    expect(moveView(views, -1, 1)).toBe(views);
  });
});
