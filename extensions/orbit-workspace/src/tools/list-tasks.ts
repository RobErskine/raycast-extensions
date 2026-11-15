import type { Priority } from "../api/types";
import { openOrbit, withErrors } from "../ai/context";
import { listTasks } from "../ai/tasks";

type Input = {
  /** The name of a saved task view (see list-task-views). Other inputs add to or replace its filters. */
  view?: string;
  /** Project key (for example DBM), name, or ID. Omit for all projects. */
  project?: string;
  /** A status name of the project (for example "In Progress"), or a category: open, in progress, done, cancelled. Without a project, it matches that status in every project. */
  status?: string;
  /** "open" (default) for tasks not done, "done" for done or cancelled tasks, "all" for both. Not used when status is given. */
  state?: "open" | "done" | "all";
  /** "me" for my tasks, "none" for unassigned tasks, or a member's name. */
  assignee?: string;
  priority?: Priority;
  /** A label name. */
  label?: string;
  /** Words in the title or description, or a task identifier such as DBM-12. */
  query?: string;
  /** Default: updated_at (newest first). due_date and title sort ascending. */
  sort?: "updated_at" | "created_at" | "priority" | "due_date" | "title";
  /** About how many tasks to return, from 1 to 100 (a few more can come back). Default: 25. */
  limit?: number;
  /** The nextCursor of the previous result, for more tasks. */
  cursor?: string;
};

export default async function (input: Input) {
  return withErrors(async () => listTasks(await openOrbit("tasks:read"), input));
}
