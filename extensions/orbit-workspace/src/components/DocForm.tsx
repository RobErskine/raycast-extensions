import { Action, ActionPanel, Clipboard, Form, Icon, open, showToast, Toast, useNavigation } from "@raycast/api";
import { useCachedState, useForm } from "@raycast/utils";

import type { Doc, NewDoc } from "../api/types";
import { webUrls } from "../api/url";
import { useDocs } from "../hooks/useDocs";
import type { Orbit } from "../hooks/useOrbit";
import { docTitle } from "../lib/docs";
import { showError } from "../lib/errors";

export interface DocFormValues {
  title: string;
  markdown: string;
  place: string;
  parentId: string;
  icon: string;
}

interface DocFormProps {
  orbit: Orbit;
  /** Set when the form is pushed from another view: it pops after the doc is created. */
  onCreated?: (doc: Doc) => void;
  /** What the user typed before Raycast closed (command root only). */
  draftValues?: Partial<DocFormValues>;
}

export function DocForm({ orbit, onCreated, draftValues }: DocFormProps) {
  const { pop } = useNavigation();
  const [lastPlace, setLastPlace] = useCachedState<string>("create-doc.place", "default");
  const { all, isLoading } = useDocs(orbit);

  const { handleSubmit, itemProps, values, reset, focus, setValidationError } = useForm<DocFormValues>({
    initialValues: { place: lastPlace, parentId: "", icon: "", ...draftValues },
    validation: {
      title: (value) => {
        if (!value?.trim()) return "The title is required";
        if (value.length > 500) return "The title can have at most 500 characters";
      },
      icon: (value) => ([...(value ?? "")].length > 8 ? "Use one emoji" : undefined),
    },
    async onSubmit(form) {
      if (form.place === "parent" && !form.parentId) {
        setValidationError("parentId", "Choose the parent doc");
        return false;
      }
      const toast = await showToast({ style: Toast.Style.Animated, title: "Creating doc…" });
      const body: NewDoc = {
        title: form.title.trim(),
        markdown: form.markdown || undefined,
        icon: form.icon.trim() || undefined,
        ...(form.place === "private" ? { private: true } : {}),
        ...(form.place === "parent" ? { parent_id: form.parentId } : {}),
      };
      try {
        const doc = await orbit.client.createDoc(body);
        const url = webUrls.doc(orbit.client.base, orbit.workspaceId, doc.id);
        setLastPlace(form.place);
        toast.style = Toast.Style.Success;
        toast.title = `Created ${docTitle(doc)}`;
        toast.primaryAction = { title: "Open in Orbit", onAction: () => open(url) };
        toast.secondaryAction = { title: "Copy Link", onAction: () => Clipboard.copy(url) };
        if (onCreated) {
          onCreated(doc);
          pop();
        } else {
          reset({ ...form, title: "", markdown: "", icon: "" });
          focus("title");
        }
      } catch (error) {
        await toast.hide();
        await showError(error, "Could not create the doc");
      }
    },
  });

  return (
    <Form
      isLoading={isLoading}
      // Root screens take the command's title; drafts are kept for the command only.
      navigationTitle={onCreated ? "Create Doc" : undefined}
      enableDrafts={!onCreated}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Doc" icon={Icon.NewDocument} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Title" placeholder="Doc title" autoFocus {...itemProps.title} />
      <Form.TextArea title="Content" placeholder="Write in Markdown" enableMarkdown {...itemProps.markdown} />
      <Form.Separator />
      <Form.Dropdown title="Location" {...itemProps.place}>
        <Form.Dropdown.Item value="default" title="Default Teamspace" icon={Icon.TwoPeople} />
        <Form.Dropdown.Item value="private" title="Private" icon={Icon.Lock} />
        <Form.Dropdown.Item value="parent" title="Inside Another Doc…" icon={Icon.Document} />
      </Form.Dropdown>
      {values.place === "parent" && (
        <Form.Dropdown title="Parent Doc" placeholder="Search docs" {...itemProps.parentId}>
          {all.map(({ doc, title, path }) => (
            <Form.Dropdown.Item
              key={doc.id}
              value={doc.id}
              title={path ? `${title} — ${path}` : title}
              icon={doc.icon ? doc.icon : doc.private ? Icon.Lock : Icon.Document}
              keywords={path ? path.split(" › ") : undefined}
            />
          ))}
        </Form.Dropdown>
      )}
      <Form.TextField title="Icon" placeholder="Optional emoji, for example 📝" {...itemProps.icon} />
    </Form>
  );
}
