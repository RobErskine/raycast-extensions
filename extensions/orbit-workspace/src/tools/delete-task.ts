import { Action, type Tool } from "@raycast/api";

import { openOrbit, withErrors } from "../ai/context";
import { refreshMenuBar } from "../lib/menu-bar";

type Input = {
  /** Task identifier (for example DBM-12) or ID. */
  task: string;
};

export const confirmation: Tool.Confirmation<Input> = (input) =>
  withErrors(async () => {
    const task = await (await openOrbit("tasks:write")).client.getTask(input.task.trim());
    return {
      style: Action.Style.Destructive,
      message: `Move ${task.identifier} and its sub-issues to the trash? They can be restored in Orbit for 30 days.`,
      info: [{ name: "Task", value: `${task.identifier}: ${task.title}` }],
    };
  });

/** Moves a task and its sub-issues to the Orbit trash. Only when the user asks to delete it. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:write");
    const task = await orbit.client.getTask(input.task.trim());
    await orbit.client.deleteTask(task.id, task.version);
    refreshMenuBar();
    return { task: task.identifier, title: task.title, movedToTrash: true };
  });
}
