/**
 * Mirrors Faite's `openapi/v1.json`, hand-written rather than generated.
 *
 * Only the fields this extension actually reads are declared. A response
 * carrying more is fine — these are structural types over JSON, not a
 * validation layer — but a field named here that the API drops would be a
 * silent `undefined`, so keep it to what is used.
 */

export type TodoStatus = "open" | "done" | "dropped";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Todo {
  id: string;
  title: string;
  /** Markdown. */
  description: string | null;
  status: TodoStatus;
  priority: Priority | null;
  /** Civil date, `YYYY-MM-DD` — a day in the user's timezone, not an instant. */
  scheduledDate: string | null;
  deadline: string | null;
  listId: string | null;
  labelIds: string[];
  location: string | null;
  parentId: string | null;
  completedAt: string | null;
  reminderTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  name: string;
  /** True for exactly one list per account. It cannot be deleted. */
  isBacklog: boolean;
  archivedAt: string | null;
  tabId: string | null;
  /** Free-form prose describing what belongs here. The AI tools read it. */
  description: string | null;
  color: string | null;
  emoji: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string | null;
  emoji: string | null;
}

export interface Tab {
  id: string;
  name: string;
  /** True for exactly one tab per account. It cannot be deleted. */
  isDefault: boolean;
  archivedAt: string | null;
}

/** One Markdown note per calendar day. Addressed by date, not by id. */
export interface DayNote {
  date: string;
  body: string;
}

/**
 * Account-level settings. Deliberately excludes the device-local board
 * layout preferences — they describe one screen, not the account.
 */
export interface Profile {
  displayName: string | null;
  timezone: string;
  /** How many days a to-do may be missed before it falls into Overflow. */
  overflowAfterDays: number;
  visibleDays: number;
  workdays: number[];
}
