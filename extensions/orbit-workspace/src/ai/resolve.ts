import type { Conversation, DocSummary, Label, Member, Project, Status, StatusCategory } from "../api/types";
import { conversationTitle } from "../lib/chat-format";
import { docTitle } from "../lib/docs";
import { defaultStatus, doneStatus } from "../lib/tasks";

/** A name the AI gave that matches nothing, or more than one thing. The AI reads the message. */
export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolveError";
  }
}

const norm = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lists at most `max` names for an error message. */
function some(names: string[], max = 15): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown}, and ${names.length - max} more` : shown || "none";
}

/**
 * Finds one item by ID, then by an exact key or name (any letter case), then by a unique partial
 * name. It never picks one of several partial matches.
 */
function pick<T>(
  items: T[],
  ref: string,
  what: string,
  id: (item: T) => string,
  names: (item: T) => string[],
  label: (item: T) => string,
): T {
  const wanted = norm(ref);
  if (!wanted) throw new ResolveError(`The ${what} is empty.`);
  const byId = items.find((item) => id(item) === ref.trim());
  if (byId) return byId;
  const exact = items.filter((item) => names(item).some((name) => norm(name) === wanted));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new ResolveError(`"${ref}" matches more than one ${what}: ${some(exact.map(label))}. Ask which one.`);
  }
  const partial = items.filter((item) => names(item).some((name) => norm(name).includes(wanted)));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new ResolveError(`"${ref}" matches more than one ${what}: ${some(partial.map(label))}. Ask which one.`);
  }
  throw new ResolveError(`No ${what} matches "${ref}". Known: ${some(items.map(label))}.`);
}

export function resolveProject(projects: Project[], ref: string): Project {
  return pick(
    projects,
    ref,
    "project",
    (p) => p.id,
    (p) => [p.key, p.name],
    (p) => `${p.name} (${p.key})`,
  );
}

/** Words people use for a status category. */
const CATEGORY_WORDS: Record<string, StatusCategory> = {
  open: "unstarted",
  todo: "unstarted",
  "to do": "unstarted",
  unstarted: "unstarted",
  backlog: "unstarted",
  "not started": "unstarted",
  started: "started",
  "in progress": "started",
  doing: "started",
  active: "started",
  done: "completed",
  complete: "completed",
  completed: "completed",
  closed: "completed",
  finished: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  duplicate: "duplicate",
};

/**
 * The status of one project that a name means: a status name, else a category word such as
 * "done" (the project's first completed status) or "in progress".
 */
export function resolveStatus(projectStatuses: Status[], ref: string): Status {
  const wanted = norm(ref);
  const byName = projectStatuses.filter((s) => s.id === ref.trim() || norm(s.name) === wanted);
  if (byName.length === 1) return byName[0];
  const category = CATEGORY_WORDS[wanted];
  if (category) {
    const sorted = [...projectStatuses].sort((a, b) => a.position - b.position);
    const status =
      category === "completed"
        ? doneStatus(sorted)
        : category === "unstarted"
          ? defaultStatus(sorted.filter((s) => s.category === "unstarted"))
          : sorted.find((s) => s.category === category);
    if (status) return status;
  }
  return pick(
    projectStatuses,
    ref,
    "status of this project",
    (s) => s.id,
    (s) => [s.name],
    (s) => s.name,
  );
}

/**
 * The IDs of all statuses (of any project) that a name or category word means. Used to filter
 * tasks by status without a project.
 */
export function matchingStatusIds(statuses: Status[], ref: string): Set<string> {
  const wanted = norm(ref);
  const category = CATEGORY_WORDS[wanted];
  const ids = statuses
    .filter((s) => s.id === ref.trim() || norm(s.name) === wanted || (category && s.category === category))
    .map((s) => s.id);
  if (ids.length === 0) {
    const names = [...new Set(statuses.map((s) => s.name))];
    throw new ResolveError(`No status matches "${ref}". Known: ${some(names)}, or open, in progress, done.`);
  }
  return new Set(ids);
}

/** "me", "none" (nobody), a user ID or a member's name. Returns a user ID, or "none". */
export function resolveAssignee(members: Member[], ref: string, userId: string | undefined): string {
  const wanted = norm(ref);
  if (wanted === "me" || wanted === "myself") {
    if (!userId) throw new ResolveError("This API token is a service account, so it has no 'me'.");
    return userId;
  }
  if (["none", "nobody", "null", "unassigned", "no one"].includes(wanted)) return "none";
  return resolveMember(members, ref, userId);
}

/** "me", a user ID or a member's name. Returns a user ID. */
export function resolveMember(members: Member[], ref: string, userId: string | undefined): string {
  if (["me", "myself"].includes(norm(ref))) {
    if (!userId) throw new ResolveError("This API token is a service account, so it has no 'me'.");
    return userId;
  }
  return pick(
    members,
    ref,
    "member",
    (m) => m.user_id,
    (m) => [m.display_name, m.display_name.split(" ")[0]],
    (m) => m.display_name,
  ).user_id;
}

export function resolveLabel(labels: Label[], ref: string): Label {
  return pick(
    labels,
    ref,
    "label",
    (l) => l.id,
    (l) => [l.name],
    (l) => l.name,
  );
}

/** A doc by ID or title. */
export function resolveDoc(docs: DocSummary[], ref: string): DocSummary {
  return pick(
    docs,
    ref,
    "doc",
    (d) => d.id,
    (d) => [docTitle(d)],
    (d) => docTitle(d),
  );
}

/** A conversation by ID, `#channel` name, or the names of the people in a direct message. */
export function resolveConversation(
  conversations: Conversation[],
  ref: string,
  members: Map<string, string>,
  userId: string | undefined,
): Conversation {
  const title = (c: Conversation) => conversationTitle(c, members, userId);
  return pick(
    conversations,
    ref.trim().replace(/^#/, ""),
    "conversation",
    (c) => c.id,
    (c) => [title(c).replace(/^#/, ""), ...(c.name ? [c.name] : [])],
    title,
  );
}

/**
 * A due date as Orbit's `due_at`: a date (`2026-11-20`) means the end of that day in local time;
 * a full timestamp is kept. "none" clears the date (null).
 */
export function parseDueDate(value: string): string | null {
  const text = value.trim();
  if (["none", "null", "clear", ""].includes(text.toLowerCase())) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 23, 59, 59);
    if (date.getMonth() !== Number(dateOnly[2]) - 1) throw new ResolveError(`"${value}" is not a valid date.`);
    return date.toISOString();
  }
  const time = Date.parse(text);
  if (Number.isNaN(time)) throw new ResolveError(`"${value}" is not a date. Use ISO 8601, for example 2026-11-20.`);
  return new Date(time).toISOString();
}

export function isUuid(value: string): boolean {
  return UUID.test(value.trim());
}
