import type { Tool } from "@raycast/api";

import { openOrbit, withErrors } from "../ai/context";

type Input = {
  /** Task identifier (for example DBM-12) or ID. */
  task: string;
  /** The comment, in Markdown. */
  body: string;
};

export const confirmation: Tool.Confirmation<Input> = (input) =>
  withErrors(async () => {
    const task = await (await openOrbit("tasks:write")).client.getTask(input.task.trim());
    return {
      message: "Add this comment in Orbit?",
      info: [
        { name: "Task", value: `${task.identifier}: ${task.title}` },
        { name: "Comment", value: input.body },
      ],
    };
  });

/** Adds a comment to a task. */
export default async function (input: Input) {
  return withErrors(async () => {
    if (!input.body?.trim()) throw new Error("The comment is empty.");
    const orbit = await openOrbit("tasks:write");
    const task = await orbit.client.getTask(input.task.trim());
    await orbit.client.createComment(task.id, input.body);
    return { task: task.identifier, url: task.url, commented: true };
  });
}
