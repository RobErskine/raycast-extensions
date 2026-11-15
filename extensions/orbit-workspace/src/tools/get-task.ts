import { openOrbit, withErrors } from "../ai/context";
import { serializeComment, serializeTask } from "../ai/serialize";

type Input = {
  /** Task identifier (for example DBM-12) or ID. */
  task: string;
  /** Also return the task's comments. Default: true. */
  includeComments?: boolean;
};

/** One task with its description, labels and comments. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:read");
    const task = await orbit.client.getTask(input.task.trim());
    const [names, labels, comments] = await Promise.all([
      orbit.names(),
      orbit.labelsOf(task.project_id),
      input.includeComments === false ? Promise.resolve([]) : orbit.client.comments(task.id),
    ]);
    return {
      ...serializeTask(task, { ...names, labels: new Map(labels.map((l) => [l.id, l])) }, true),
      comments: comments.map((c) => serializeComment(c, names.members)),
    };
  });
}
