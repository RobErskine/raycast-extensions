import type { Priority, Status, Task } from "../api/types";

export const DONE_CATEGORIES = new Set<Status["category"]>(["completed", "cancelled", "duplicate"]);

export function isOpen(task: Task, statuses: Map<string, Status>): boolean {
  const status = statuses.get(task.status_id);
  return !status || !DONE_CATEGORIES.has(status.category);
}

/** The status that "Mark as Done" moves a task to: the first "completed" status of its project. */
export function doneStatus(statuses: Status[]): Status | undefined {
  return [...statuses].sort((a, b) => a.position - b.position).find((s) => s.category === "completed");
}

/** The default status of a new task: the first "unstarted" status, else the first one. */
export function defaultStatus(statuses: Status[]): Status | undefined {
  const sorted = [...statuses].sort((a, b) => a.position - b.position);
  return sorted.find((s) => s.category === "unstarted") ?? sorted[0];
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/** Urgent first, then by due date (no date last), then newest update. */
export function compareByUrgency(a: Task, b: Task): number {
  const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priority !== 0) return priority;
  const dueA = a.due_at ? Date.parse(a.due_at) : Infinity;
  const dueB = b.due_at ? Date.parse(b.due_at) : Infinity;
  if (dueA !== dueB) return dueA - dueB;
  return Date.parse(b.updated_at) - Date.parse(a.updated_at);
}

/** End of the given day in local time, as Orbit's RFC 3339 `due_at`. */
export function endOfDayIso(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 0);
  return end.toISOString();
}

/** True when the task is due within `days` days from `now` (overdue included). */
export function isDueWithin(task: Task, days: number, now = new Date()): boolean {
  if (!task.due_at) return false;
  return Date.parse(task.due_at) <= now.getTime() + days * 24 * 60 * 60 * 1000;
}
