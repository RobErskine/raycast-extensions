import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";

import type { DocSummary } from "../api/types";
import type { Orbit } from "../hooks/useOrbit";
import { appendMarkdown, docTitle } from "../lib/docs";
import { showError } from "../lib/errors";
import { withVersionRetry } from "../lib/retry";

export function AppendDocForm({ orbit, doc, onDone }: { orbit: Orbit; doc: DocSummary; onDone?: () => void }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ text: string }>({
    validation: { text: FormValidation.Required },
    async onSubmit({ text }) {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Adding to doc…" });
      try {
        const read = () => orbit.client.getDoc(doc.id);
        await withVersionRetry(await read(), read, (current) =>
          orbit.client.updateDoc(doc.id, {
            expected_version: current.version,
            markdown: appendMarkdown(current.markdown, text),
          }),
        );
        toast.style = Toast.Style.Success;
        toast.title = `Added to ${docTitle(doc)}`;
        onDone?.();
        pop();
      } catch (error) {
        await toast.hide();
        await showError(error, "Could not add to the doc");
      }
    },
  });
  return (
    <Form
      navigationTitle={`Add to ${docTitle(doc)}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add to Doc" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Doc" text={docTitle(doc)} />
      <Form.TextArea
        title="Text"
        placeholder="Markdown to add at the end of the doc"
        enableMarkdown
        autoFocus
        {...itemProps.text}
      />
    </Form>
  );
}
