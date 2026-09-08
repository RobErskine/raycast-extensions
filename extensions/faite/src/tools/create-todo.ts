import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import { listName } from "./confirmation";
import type { Todo } from "../lib/types";

type Input = {
  /**
   * The to-do itself, as an imperative phrase. Strip any date, priority or
   * list wording out of it and put those in their own fields — "buy milk
   * tomorrow" becomes a title of "Buy milk" with scheduledDate set.
   */
  title: string;
  /**
   * Longer notes, in Markdown. Use this for detail that does not belong in
   * the title, such as context pulled from a meeting transcript.
   */
  description?: string;
  /**
   * The list this belongs in, as a list ID. Call get-lists first and match
   * the user's wording against each list's name AND its description — the
   * description says what belongs there. Omit this if nothing clearly fits;
   * the to-do will land in Backlog, which is the correct default.
   */
  listId?: string;
  /**
   * The day to work on this, as YYYY-MM-DD. Only include this when the user
   * actually names a day. Do not invent one — an unscheduled to-do sitting
   * in a list is a normal, useful state, not an incomplete one.
   */
  scheduledDate?: string;
  /**
   * A hard due date, as YYYY-MM-DD. This is different from scheduledDate: a
   * deadline is when it must be done BY, not when you plan to do it. Only set
   * it when the user says "due", "by", or names a real deadline.
   */
  deadline?: string;
  /**
   * Only set this when the user signals urgency. Most to-dos have no
   * priority, and inventing one makes the field meaningless.
   */
  priority?: "low" | "medium" | "high" | "urgent";
  /**
   * Label IDs, comma-separated — for example "id-one,id-two". Call get-labels
   * first and never guess an ID.
   *
   * A comma-separated string rather than an array because `ray build`'s
   * schema extractor crashes on an array-typed tool input in this toolchain
   * version. See `labelIdList` for the reasoning.
   */
  labelIds?: string;
};

/**
 * Splits the comma-separated label list.
 *
 * **This should be `string[]`.** `ray build` fails with "Cannot read
 * properties of undefined (reading 'flags')" for ANY array-typed field on a
 * tool `Input` here — reproduced down to a two-field type on a plain,
 * unwrapped tool, so it is neither this extension's auth wrapper nor its
 * types. Other published extensions do ship array inputs, so this looks like
 * a toolchain regression rather than an unsupported feature. Revisit on the
 * next @raycast/api bump; the model handles a documented comma list fine, so
 * this costs clarity rather than capability.
 */
export function labelIdList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/** Create a to-do. */
export default withFaite(async ({ labelIds, ...input }: Input) =>
  api.post<Todo>("/todos", { ...input, ...(labelIdList(labelIds) ? { labelIds: labelIdList(labelIds) } : {}) }),
);

/**
 * Creating is cheap and reversible, so this confirms only when the model has
 * made a judgment call the user did not explicitly ask for — a date, a
 * priority, or a list. A plain "add X to my to-dos" runs unconfirmed, which
 * is the whole point of asking an assistant to do it.
 */
export const confirmation = withFaite(async (input: Input) => {
  const inferred = [input.scheduledDate, input.deadline, input.priority, input.listId].some(Boolean);
  if (!inferred) return undefined;

  const list = await listName(input.listId);

  return {
    message: `Add “${input.title}” to Faite?`,
    info: [
      { name: "To-do", value: input.title },
      ...(list ? [{ name: "List", value: list }] : []),
      ...(input.scheduledDate ? [{ name: "Scheduled", value: input.scheduledDate }] : []),
      ...(input.deadline ? [{ name: "Deadline", value: input.deadline }] : []),
      ...(input.priority ? [{ name: "Priority", value: input.priority }] : []),
    ],
  };
});
