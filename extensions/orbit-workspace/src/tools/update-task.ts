import type { Tool } from "@raycast/api";

import type { Priority } from "../api/types";
import { openOrbit, withErrors } from "../ai/context";
import { serializeTask } from "../ai/serialize";
import { prepareUpdateTask } from "../ai/tasks";
import { refreshMenuBar } from "../lib/menu-bar";
import { withVersionRetry } from "../lib/retry";

type Input = {
  /** Task identifier (for example DBM-12) or ID. */
  task: string;
  title?: string;
  /** Markdown. Replaces the whole description: read it with get-task first to edit part of it. */
  description?: string;
  /** A status name of the task's project, or open, in progress, done, cancelled. Use "done" to close a task. */
  status?: string;
  priority?: Priority;
  /** "me" or members' names. Replaces all assignees; [] removes them all. */
  assignees?: string[];
  /** Label names. Replaces all labels; [] removes them all. */
  labels?: string[];
  /** ISO 8601 date (2026-11-20, end of that day) or timestamp; "none" removes the due date. */
  dueDate?: string;
};

export const confirmation: Tool.Confirmation<Input> = (input) =>
  withErrors(async () => {
    const { info } = await prepareUpdateTask(await openOrbit("tasks:write"), input);
    return { message: "Change this task in Orbit?", info };
  });

/** Changes a task: title, description, status, priority, assignees, labels or due date. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:write");
    const { task, patch } = await prepareUpdateTask(orbit, input);
    const saved = await withVersionRetry(
      task,
      () => orbit.client.getTask(task.id),
      (current) => orbit.client.updateTask(task.id, { ...patch, expected_version: current.version }),
    );
    refreshMenuBar();
    return serializeTask(saved, await orbit.names());
  });
}
