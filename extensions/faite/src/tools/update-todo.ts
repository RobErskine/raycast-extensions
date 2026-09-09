import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import { labelIdList } from "../lib/labels";
import { listName, todoTitle } from "./confirmation";
import type { Todo } from "../lib/types";

type Input = {
  /** The to-do's ID. Call get-todos first; never guess an ID. */
  id: string;
  /** A new title. Omit to leave it alone. */
  title?: string;
  /** New notes, in Markdown. Omit to leave them alone. */
  description?: string;
  /** Move it to this list, by ID. Call get-lists first. */
  listId?: string;
  /**
   * Reschedule to this day, as YYYY-MM-DD. Pass an empty string to
   * unschedule it entirely.
   */
  scheduledDate?: string;
  /** A hard due date, as YYYY-MM-DD. Pass an empty string to clear it. */
  deadline?: string;
  /** Pass an empty string to clear the priority. */
  priority?: "low" | "medium" | "high" | "urgent" | "";
  /**
   * Label IDs, comma-separated — for example "id-one,id-two". REPLACES the
   * whole label set, so include every label it should end up with, not just
   * new ones. Call get-labels first.
   *
   * A comma-separated string rather than an array for the toolchain reason
   * documented on `create-todo`'s `labelIdList`.
   */
  labelIds?: string;
  /**
   * Use complete-todo for marking something done — it is clearer and sets
   * the completion time. Use this only to drop a to-do, or to reopen one.
   */
  status?: "open" | "done" | "dropped";
};

/**
 * Change an existing to-do. Only the fields you pass are touched; everything
 * else is left exactly as it was.
 *
 * Raycast's tool schema only supports string unions, so a nullable field
 * cannot be declared as `string | null` — an EMPTY STRING is the clear
 * signal, translated to a real `null` here before it reaches the API.
 */
export default withFaite(async ({ id, ...patch }: Input) => {
  // `Record<string, unknown>`, not the inferred shape of `patch`: `labelIds`
  // arrives as a comma-separated STRING (see `labelIdList`) and leaves as an
  // array, so the value type genuinely changes on the way through.
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === "" ? null : value]),
  );

  if (typeof body.labelIds === "string") body.labelIds = labelIdList(body.labelIds) ?? [];
  return api.patch<Todo>(`/todos/${id}`, body);
});

/** Always confirms: an edit overwrites something that already exists, and the
 * user cannot see which fields the model chose without being shown. */
export const confirmation = withFaite(async (input: Input) => {
  const [title, list] = await Promise.all([todoTitle(input.id), listName(input.listId)]);

  const changes = [
    input.title ? { name: "New title", value: input.title } : null,
    input.description ? { name: "Notes", value: "replaced" } : null,
    list ? { name: "Move to list", value: list } : null,
    input.scheduledDate !== undefined ? { name: "Scheduled", value: input.scheduledDate || "cleared" } : null,
    input.deadline !== undefined ? { name: "Deadline", value: input.deadline || "cleared" } : null,
    input.priority !== undefined ? { name: "Priority", value: input.priority || "cleared" } : null,
    input.labelIds ? { name: "Labels", value: `${labelIdList(input.labelIds)?.length ?? 0} label(s)` } : null,
    input.status ? { name: "Status", value: input.status } : null,
  ].filter((change): change is { name: string; value: string } => change !== null);

  return { message: `Update “${title}”?`, info: changes };
});
