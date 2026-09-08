import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useState } from "react";
import { api } from "../lib/api";
import { useDayNote } from "../lib/hooks";
import type { DayNote } from "../lib/types";

/**
 * One day's Markdown note.
 *
 * A day note is per DAY, not per to-do — a to-do's own notes are its
 * `description`, edited in the to-do form. Two different things, both
 * Markdown, and the copy here says which one you are in.
 *
 * There is no delete: clearing a note is writing an empty body. The id is
 * derived from the date and is recreated the moment that day is opened
 * again, so a tombstone would buy nothing. Offering a Delete action would
 * imply a distinction that does not exist.
 */
export function DayNoteForm({ date }: { date: string }) {
  const { pop } = useNavigation();
  const { data, isLoading } = useDayNote(date);
  const [body, setBody] = useState<string | undefined>(undefined);

  // `data` arrives after the first render, so the field is uncontrolled until
  // it does and controlled after — `value ?? data?.body ?? ""` keeps the
  // user's typing from being clobbered by a late fetch.
  const value = body ?? data?.body ?? "";

  const save = async () => {
    try {
      await api.put<DayNote>(`/day-notes/${date}`, { body: value });
      await showToast({
        style: Toast.Style.Success,
        title: value.trim() ? "Note saved" : "Note cleared",
      });
      pop();
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't save that note" });
    }
  };

  return (
    <Form
      isLoading={isLoading}
      navigationTitle={`Day Note — ${date}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Note" icon={Icon.Check} onSubmit={save} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Day Note"
        text={`Notes for ${date}. This belongs to the whole day, not to any one to-do.`}
      />
      <Form.TextArea
        id="body"
        title="Notes"
        placeholder="Markdown is supported"
        enableMarkdown
        value={value}
        onChange={setBody}
      />
    </Form>
  );
}
