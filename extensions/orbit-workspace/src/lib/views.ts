import { PRIORITIES, type Priority, type Status, type Task, type TaskQuery } from "../api/types";

import { isOpen } from "./tasks";

export type ViewState = "open" | "done" | "all";
export type ViewSort = "updated_at" | "created_at" | "priority" | "due_date" | "title";

/** The filters of a task view. Empty strings mean "any". */
export interface ViewFilter {
  projectId: string;
  /** One status of the project. When set, `state` is not used. */
  statusId: string;
  state: ViewState;
  /** "me" (the token's person), "none" (no assignee), a user ID, or "" (anyone). */
  assignee: string;
  priority: "" | Priority;
  labelId: string;
  /** Text in the title or description, or an identifier. */
  query: string;
  sort: ViewSort;
}

/** A saved task view. Views live in the extension, not in Orbit. */
export interface TaskView {
  id: string;
  name: string;
  filter: ViewFilter;
}

export const EMPTY_FILTER: ViewFilter = {
  projectId: "",
  statusId: "",
  state: "open",
  assignee: "",
  priority: "",
  labelId: "",
  query: "",
  sort: "updated_at",
};

export const SORT_TITLE: Record<ViewSort, string> = {
  updated_at: "Last Updated",
  created_at: "Newest",
  priority: "Priority",
  due_date: "Due Date",
  title: "Title",
};

/** The API query of a view. `searchText`, when typed, replaces the view's own text. */
export function viewQuery(filter: ViewFilter, userId: string | undefined, searchText = ""): TaskQuery {
  const assignee = filter.assignee === "me" ? userId : filter.assignee;
  const ascending = filter.sort === "due_date" || filter.sort === "title";
  return {
    project_id: filter.projectId || undefined,
    status_id: filter.statusId || undefined,
    assignee_id: assignee || undefined,
    priority: filter.priority || undefined,
    label_id: filter.labelId || undefined,
    q: searchText.trim() || filter.query.trim() || undefined,
    sort: filter.sort,
    order: ascending ? "asc" : "desc",
  };
}

/** The open/done filter, which the API cannot do. */
export function matchesState(task: Task, filter: ViewFilter, statuses: Map<string, Status>): boolean {
  if (filter.statusId || filter.state === "all") return true;
  return filter.state === "open" ? isOpen(task, statuses) : !isOpen(task, statuses);
}

export interface Names {
  projects: Map<string, string>;
  statuses: Map<string, string>;
  members: Map<string, string>;
  labels: Map<string, string>;
}

/** A one-line summary, for example "DBM · Open · Assigned to me · High". */
export function describeView(filter: ViewFilter, names: Names): string {
  const parts = [filter.projectId ? (names.projects.get(filter.projectId) ?? "Unknown project") : "All projects"];
  if (filter.statusId) parts.push(names.statuses.get(filter.statusId) ?? "One status");
  else if (filter.state !== "all") parts.push(filter.state === "open" ? "Open" : "Done");
  if (filter.assignee === "me") parts.push("Assigned to me");
  else if (filter.assignee === "none") parts.push("Unassigned");
  else if (filter.assignee) parts.push(`Assigned to ${names.members.get(filter.assignee) ?? "a member"}`);
  if (filter.priority) parts.push(filter.priority[0].toUpperCase() + filter.priority.slice(1));
  if (filter.labelId) parts.push(names.labels.get(filter.labelId) ?? "One label");
  if (filter.query.trim()) parts.push(`"${filter.query.trim()}"`);
  return parts.join(" · ");
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Reads a view from storage or from a quicklink, which can hold anything. */
export function parseView(value: unknown): TaskView | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id, 100);
  const name = text(raw.name, 80).trim();
  if (!id || !name) return undefined;
  const f = (raw.filter && typeof raw.filter === "object" ? raw.filter : {}) as Record<string, unknown>;
  return {
    id,
    name,
    filter: {
      projectId: text(f.projectId, 100),
      statusId: text(f.statusId, 100),
      state: oneOf(f.state, ["open", "done", "all"], "open"),
      assignee: text(f.assignee, 100),
      priority: oneOf(f.priority, ["", ...PRIORITIES], ""),
      labelId: text(f.labelId, 100),
      query: text(f.query, 500),
      sort: oneOf(f.sort, ["updated_at", "created_at", "priority", "due_date", "title"], "updated_at"),
    },
  };
}

export function parseViews(value: unknown): TaskView[] {
  return Array.isArray(value) ? value.map(parseView).filter((v): v is TaskView => v !== undefined) : [];
}

/** Moves the view at `index` by `offset` places. */
export function moveView(views: TaskView[], index: number, offset: number): TaskView[] {
  const target = index + offset;
  if (index < 0 || index >= views.length || target < 0 || target >= views.length) return views;
  const next = [...views];
  const [view] = next.splice(index, 1);
  next.splice(target, 0, view);
  return next;
}
