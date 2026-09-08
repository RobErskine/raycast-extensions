import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, MutatePromise, showFailureToast, useForm } from "@raycast/utils";
import { api } from "../lib/api";
import { useLabels, useLists } from "../lib/hooks";
import type { Priority, Todo } from "../lib/types";

/**
 * Create or edit a to-do.
 *
 * One form for both, because the fields are identical and the only real
 * difference is which verb the submit button uses. `todo` absent means
 * create.
 *
 * Notes are a plain `TextArea`: `description` is Markdown on the server, and
 * a launcher is the wrong place for a rich-text editor. What you type is what
 * is stored.
 */

interface Values {
  title: string;
  description: string;
  listId: string;
  labelIds: string[];
  priority: string;
  scheduledDate: Date | null;
  deadline: Date | null;
  location: string;
}

interface Props {
  todo?: Todo;
  /** Passed down so the list a form was opened from refreshes on submit,
   * rather than waiting for its own next revalidate. */
  mutate?: MutatePromise<Todo[] | undefined>;
  /** Prefills the list when creating from inside one. */
  defaultListId?: string;
}

/** The API wants a civil date; a Form.DatePicker hands back a local Date.
 * Taking local Y-M-D rather than `toISOString()` keeps a late-evening pick on
 * the day the user actually chose instead of shifting it in UTC. */
function toCivilDate(date: Date | null): string | null {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Parsed as UTC noon so no timezone can drag the rendered day either side of
 * midnight — the picker only ever shows a day, never a time. */
function fromCivilDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

const PRIORITIES: { value: Priority | ""; title: string }[] = [
  { value: "", title: "None" },
  { value: "low", title: "Low" },
  { value: "medium", title: "Medium" },
  { value: "high", title: "High" },
  { value: "urgent", title: "Urgent" },
];

export function TodoForm({ todo, mutate, defaultListId }: Props) {
  const { pop } = useNavigation();
  const { data: lists, isLoading: loadingLists } = useLists();
  const { data: labels, isLoading: loadingLabels } = useLabels();

  const editing = Boolean(todo);

  const { handleSubmit, itemProps } = useForm<Values>({
    async onSubmit(values) {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim() || null,
        listId: values.listId || null,
        labelIds: values.labelIds,
        priority: (values.priority || null) as Priority | null,
        scheduledDate: toCivilDate(values.scheduledDate),
        deadline: toCivilDate(values.deadline),
        location: values.location.trim() || null,
      };

      try {
        const write = editing ? api.patch<Todo>(`/todos/${todo!.id}`, payload) : api.post<Todo>("/todos", payload);

        if (mutate) {
          await mutate(write, { shouldRevalidateAfter: true });
        } else {
          await write;
        }

        await showToast({
          style: Toast.Style.Success,
          title: editing ? "Saved" : "Added to-do",
          message: payload.title,
        });
        pop();
      } catch (error) {
        await showFailureToast(error, { title: editing ? "Couldn't save" : "Couldn't add that to-do" });
      }
    },
    validation: { title: FormValidation.Required },
    initialValues: {
      title: todo?.title ?? "",
      description: todo?.description ?? "",
      listId: todo?.listId ?? defaultListId ?? "",
      labelIds: todo?.labelIds ?? [],
      priority: todo?.priority ?? "",
      scheduledDate: fromCivilDate(todo?.scheduledDate ?? null),
      deadline: fromCivilDate(todo?.deadline ?? null),
      location: todo?.location ?? "",
    },
  });

  return (
    <Form
      isLoading={loadingLists || loadingLabels}
      navigationTitle={editing ? "Edit To-Do" : "New To-Do"}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={editing ? "Save Changes" : "Add To-Do"}
            icon={editing ? Icon.Check : Icon.Plus}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField title="Title" placeholder="What needs doing?" {...itemProps.title} />
      <Form.TextArea title="Notes" placeholder="Markdown is supported" enableMarkdown {...itemProps.description} />

      <Form.Separator />

      <Form.Dropdown title="List" {...itemProps.listId}>
        <Form.Dropdown.Item value="" title="No list" />
        {(lists ?? [])
          .filter((list) => !list.archivedAt)
          .map((list) => (
            <Form.Dropdown.Item key={list.id} value={list.id} title={list.name} />
          ))}
      </Form.Dropdown>

      <Form.TagPicker title="Labels" {...itemProps.labelIds}>
        {(labels ?? []).map((label) => (
          <Form.TagPicker.Item key={label.id} value={label.id} title={label.name} />
        ))}
      </Form.TagPicker>

      <Form.Dropdown title="Priority" {...itemProps.priority}>
        {PRIORITIES.map((priority) => (
          <Form.Dropdown.Item key={priority.value} value={priority.value} title={priority.title} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      <Form.DatePicker
        title="Scheduled"
        type={Form.DatePicker.Type.Date}
        info="The day you plan to work on this."
        {...itemProps.scheduledDate}
      />
      <Form.DatePicker
        title="Deadline"
        type={Form.DatePicker.Type.Date}
        info="A hard due date, independent of when you plan to do it."
        {...itemProps.deadline}
      />
      <Form.TextField title="Location" placeholder="Optional" {...itemProps.location} />
    </Form>
  );
}
