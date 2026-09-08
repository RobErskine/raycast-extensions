import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, MutatePromise, showFailureToast, useForm } from "@raycast/utils";
import { api } from "../lib/api";
import type { List } from "../lib/types";

/**
 * Create or rename a list.
 *
 * `description` is not decoration — Faite's own list_lists tool and this
 * extension's Quick Add both read it to decide where a new to-do belongs, so
 * the field says so rather than leaving the user to guess what it is for.
 */
interface Values {
  name: string;
  description: string;
}

export function ListForm({ list, mutate }: { list?: List; mutate?: MutatePromise<List[] | undefined> }) {
  const { pop } = useNavigation();
  const editing = Boolean(list);

  const { handleSubmit, itemProps } = useForm<Values>({
    async onSubmit(values) {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
      };

      try {
        const write = editing ? api.patch<List>(`/lists/${list!.id}`, payload) : api.post<List>("/lists", payload);

        if (mutate) {
          await mutate(write, { shouldRevalidateAfter: true });
        } else {
          await write;
        }

        await showToast({ style: Toast.Style.Success, title: editing ? "List saved" : "List created" });
        pop();
      } catch (error) {
        await showFailureToast(error, { title: editing ? "Couldn't save that list" : "Couldn't create that list" });
      }
    },
    validation: { name: FormValidation.Required },
    initialValues: { name: list?.name ?? "", description: list?.description ?? "" },
  });

  return (
    <Form
      navigationTitle={editing ? "Edit List" : "New List"}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={editing ? "Save Changes" : "Create List"}
            icon={editing ? Icon.Check : Icon.Plus}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField title="Name" placeholder="Errands" {...itemProps.name} />
      <Form.TextArea
        title="Description"
        placeholder="What belongs in this list?"
        info="Read by Quick Add and by AI tools when deciding where a new to-do should go."
        {...itemProps.description}
      />
    </Form>
  );
}
