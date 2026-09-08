import { Tool } from "@raycast/api";
import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import { todoTitle } from "./confirmation";
import type { Todo } from "../lib/types";

type Input = {
  /** The to-do's ID. Call get-todos first; never guess an ID. */
  id: string;
};

/** Mark a to-do done. Its own tool rather than a status update, because
 * "mark this done" is common enough to deserve a one-field call. */
export default withFaite(async ({ id }: Input) => api.patch<Todo>(`/todos/${id}`, { status: "done" }));

/** Confirms with the title, so the user is agreeing to a to-do rather than to
 * an id they cannot evaluate. Completing is reversible, so this is a light
 * check rather than a warning. */
export const confirmation: Tool.Confirmation<Input> = withFaite(async ({ id }: Input) => ({
  message: "Mark this to-do as done?",
  info: [{ name: "To-do", value: await todoTitle(id) }],
}));
