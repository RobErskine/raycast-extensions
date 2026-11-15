import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";

import type { Task } from "../api/types";
import type { Orbit } from "../hooks/useOrbit";
import { showError } from "../lib/errors";

export function CommentForm({ orbit, task }: { orbit: Orbit; task: Task }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ body: string }>({
    validation: { body: FormValidation.Required },
    async onSubmit({ body }) {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Adding comment…" });
      try {
        await orbit.client.createComment(task.id, body);
        toast.style = Toast.Style.Success;
        toast.title = `Commented on ${task.identifier}`;
        pop();
      } catch (error) {
        await toast.hide();
        await showError(error, "Could not add the comment");
      }
    },
  });
  return (
    <Form
      navigationTitle={`Comment on ${task.identifier}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Comment" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Task" text={`${task.identifier} ${task.title}`} />
      <Form.TextArea title="Comment" placeholder="Write a comment in Markdown" enableMarkdown {...itemProps.body} />
    </Form>
  );
}
