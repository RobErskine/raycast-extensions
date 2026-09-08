import { Action, Tool } from "@raycast/api";
import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import { listName, todoTitle } from "./confirmation";
import type { Todo } from "../lib/types";

type Input = {
  /** The to-do's ID. Call get-todos first; never guess an ID. */
  id: string;
};

/**
 * Delete a to-do permanently.
 *
 * Prefer complete-todo for finished work and update-todo with
 * `status: "dropped"` for work abandoned on purpose — both keep the to-do in
 * the user's history. Delete only when the user actually wants it gone.
 */
export default withFaite(async ({ id }: Input) => api.del(`/todos/${id}`));

/** Destructive, and always confirmed. Resolves the list too, since "Buy milk"
 * may exist in more than one place and the user needs to know which one is
 * about to disappear. */
export const confirmation: Tool.Confirmation<Input> = withFaite(async ({ id }: Input) => {
  let todo: Todo | null = null;
  try {
    todo = await api.get<Todo>(`/todos/${id}`);
  } catch {
    // Fall through to an id-only dialog rather than blocking the action.
  }

  const list = await listName(todo?.listId);

  return {
    style: Action.Style.Destructive,
    message: "Delete this to-do? Its sub-tasks will be kept, but the to-do itself is gone for good.",
    info: [
      { name: "To-do", value: todo?.title ?? (await todoTitle(id)) },
      ...(list ? [{ name: "List", value: list }] : []),
    ],
  };
});
