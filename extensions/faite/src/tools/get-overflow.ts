import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { Todo } from "../lib/types";

/**
 * To-dos that have slipped past the caller's Faite Loop window — scheduled
 * for a day that has passed, and missed for longer than their settings allow.
 *
 * This answers "what have I let slip". It is a DIFFERENT question from
 * get-backlog, which answers "what is unscheduled".
 *
 * The result reports placement, not visibility, so a completed to-do sitting
 * in the overflow window is included. Filter to `status: "open"` when the
 * user is asking what they still owe.
 */
export default withFaite(async () => api.get<Todo[]>("/overflow"));
