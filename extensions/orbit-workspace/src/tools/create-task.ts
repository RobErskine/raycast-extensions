import type { Tool } from "@raycast/api";

import type { Priority } from "../api/types";
import { openOrbit, withErrors } from "../ai/context";
import { serializeTask } from "../ai/serialize";
import { prepareCreateTask } from "../ai/tasks";
import { refreshMenuBar } from "../lib/menu-bar";

type Input = {
  /** Project key (for example DBM), name, or ID. */
  project: string;
  /** The task title, at most 500 characters. Do not put the due date in it. */
  title: string;
  /** Markdown. */
  description?: string;
  /** A status name of the project, or open, in progress, done. Default: the project's first open status. */
  status?: string;
  /** Default: none. */
  priority?: Priority;
  /** "me" or members' names. */
  assignees?: string[];
  /** Label names of the project. */
  labels?: string[];
  /** ISO 8601 date (2026-11-20, end of that day) or timestamp. */
  dueDate?: string;
};

export const confirmation: Tool.Confirmation<Input> = (input) =>
  withErrors(async () => {
    const { info } = await prepareCreateTask(await openOrbit("tasks:write"), input);
    return { message: "Create this task in Orbit?", info };
  });

/** Creates a task. Returns it with its identifier and URL. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:write");
    const { body } = await prepareCreateTask(orbit, input);
    const task = await orbit.client.createTask(body);
    refreshMenuBar();
    return serializeTask(task, await orbit.names());
  });
}
