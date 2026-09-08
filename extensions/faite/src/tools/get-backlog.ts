import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { Todo } from "../lib/types";

/**
 * To-dos in the Backlog list — work that exists but has not been scheduled.
 *
 * This answers "what is unscheduled". It is a DIFFERENT question from
 * get-overflow, which answers "what has slipped". Do not substitute one for
 * the other.
 */
export default withFaite(async () => api.get<Todo[]>("/backlog"));
