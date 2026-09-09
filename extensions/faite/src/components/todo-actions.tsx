import { Action, ActionPanel, Alert, confirmAlert, Color, Icon, showToast, Toast, Keyboard } from "@raycast/api";
import { MutatePromise, showFailureToast } from "@raycast/utils";
import { api } from "../lib/api";
import { DayNoteForm } from "./day-note-form";
import { TodoForm } from "./todo-form";
import { addDays, toCivilDate } from "../lib/dates";
import { todoUrl } from "../lib/hooks";
import type { List, Todo } from "../lib/types";

/**
 * The actions available on any to-do row, wherever it is rendered.
 *
 * Every write goes through `mutate` with an `optimisticUpdate`, so a row
 * disappears or moves the instant you act on it rather than after a round
 * trip. `shouldRevalidateAfter` puts the server's answer back in charge once
 * it lands — the optimistic value is a guess about what the server will do,
 * never a substitute for it.
 */

interface Props {
  todo: Todo;
  today: string;
  lists: List[] | undefined;
  mutate: MutatePromise<Todo[] | undefined>;
  /** Rendered first, so a view can put its own primary action ahead of these. */
  children?: React.ReactNode;
}

/** Removes the to-do from the current view. Correct for completing in an
 * "open" list and for deleting anywhere; a view showing all statuses will
 * simply re-add it on revalidate. */
const withoutTodo = (id: string) => (data: Todo[] | undefined) => data?.filter((t) => t.id !== id);

const replaceTodo = (updated: Todo) => (data: Todo[] | undefined) =>
  data?.map((t) => (t.id === updated.id ? updated : t));

export function TodoActions({ todo, today, lists, mutate, children }: Props) {
  const complete = async () => {
    try {
      await mutate(api.patch<Todo>(`/todos/${todo.id}`, { status: "done" }), {
        optimisticUpdate: withoutTodo(todo.id),
        shouldRevalidateAfter: true,
      });
      await showToast({ style: Toast.Style.Success, title: "Completed", message: todo.title });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't complete that to-do" });
    }
  };

  const reschedule = async (scheduledDate: string | null, label: string) => {
    try {
      await mutate(api.patch<Todo>(`/todos/${todo.id}`, { scheduledDate }), {
        // Moving a date can push a row out of a date-scoped view, so drop it
        // rather than trying to guess whether it still belongs.
        optimisticUpdate: withoutTodo(todo.id),
        shouldRevalidateAfter: true,
      });
      await showToast({ style: Toast.Style.Success, title: `Moved to ${label}`, message: todo.title });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't reschedule that to-do" });
    }
  };

  const moveToList = async (list: List) => {
    try {
      await mutate(api.patch<Todo>(`/todos/${todo.id}`, { listId: list.id }), {
        optimisticUpdate: replaceTodo({ ...todo, listId: list.id }),
        shouldRevalidateAfter: true,
      });
      await showToast({ style: Toast.Style.Success, title: `Moved to ${list.name}` });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't move that to-do" });
    }
  };

  const drop = async () => {
    try {
      await mutate(api.patch<Todo>(`/todos/${todo.id}`, { status: "dropped" }), {
        optimisticUpdate: withoutTodo(todo.id),
        shouldRevalidateAfter: true,
      });
      await showToast({ style: Toast.Style.Success, title: "Dropped", message: todo.title });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't drop that to-do" });
    }
  };

  const remove = async () => {
    // A delete is reversible in the app (an 8-second undo toast) but NOT from
    // here — there is no undo in Raycast — so this confirms and the drop
    // action above is offered as the softer alternative.
    const confirmed = await confirmAlert({
      title: "Delete this to-do?",
      message: `“${todo.title}” will be removed from Faite. Dropping it instead keeps it in your history.`,
      icon: { source: Icon.Trash, tintColor: Color.Red },
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    try {
      await mutate(api.del(`/todos/${todo.id}`), {
        optimisticUpdate: withoutTodo(todo.id),
        shouldRevalidateAfter: true,
      });
      await showToast({ style: Toast.Style.Success, title: "Deleted", message: todo.title });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't delete that to-do" });
    }
  };

  return (
    <ActionPanel>
      <ActionPanel.Section>
        {children}
        {todo.status === "open" && <Action title="Complete" icon={Icon.CheckCircle} onAction={complete} />}
        <Action.Push
          title="Edit To-Do"
          icon={Icon.Pencil}
          shortcut={Keyboard.Shortcut.Common.Edit}
          target={<TodoForm todo={todo} mutate={mutate} />}
        />
        <Action.OpenInBrowser title="Open in Faite" url={todoUrl(todo.id)} />
        {/* A to-do's own notes are its `description`, edited above. This is
            the note for the DAY it sits on — a different thing, and only
            offered when the to-do actually has a day. */}
        {todo.scheduledDate && (
          <Action.Push title="Edit Day Note" icon={Icon.Document} target={<DayNoteForm date={todo.scheduledDate} />} />
        )}
      </ActionPanel.Section>

      <ActionPanel.Section title="Schedule">
        <Action
          title="Today"
          icon={Icon.Calendar}
          shortcut={{
            macOS: { modifiers: ["cmd", "shift"], key: "t" },
            windows: { modifiers: ["ctrl", "shift"], key: "t" },
          }}
          onAction={() => reschedule(today, "today")}
        />
        <Action
          title="Tomorrow"
          icon={Icon.Calendar}
          shortcut={{
            macOS: { modifiers: ["cmd", "shift"], key: "m" },
            windows: { modifiers: ["ctrl", "shift"], key: "m" },
          }}
          onAction={() => reschedule(addDays(today, 1), "tomorrow")}
        />
        <Action title="Next Week" icon={Icon.Calendar} onAction={() => reschedule(addDays(today, 7), "next week")} />
        <Action.PickDate
          title="Pick a Date…"
          icon={Icon.Calendar}
          type={Action.PickDate.Type.Date}
          onChange={(date) => {
            // `toCivilDate` handles the local-Y-M-D conversion — `toISOString`
            // would shift a late-evening pick to the next day in UTC.
            const civil = toCivilDate(date);
            if (civil) void reschedule(civil, civil);
          }}
        />
        {todo.scheduledDate && (
          <Action title="Unschedule" icon={Icon.CalendarSlash} onAction={() => reschedule(null, "unscheduled")} />
        )}
      </ActionPanel.Section>

      {lists && lists.length > 0 && (
        <ActionPanel.Section title="Move">
          <ActionPanel.Submenu title="Move to List" icon={Icon.List}>
            {lists
              .filter((list) => !list.archivedAt && list.id !== todo.listId)
              .map((list) => (
                <Action key={list.id} title={list.name} onAction={() => moveToList(list)} />
              ))}
          </ActionPanel.Submenu>
        </ActionPanel.Section>
      )}

      <ActionPanel.Section>
        <Action.CopyToClipboard title="Copy Title" content={todo.title} />
        <Action.CopyToClipboard title="Copy Link" content={todoUrl(todo.id)} />
        {todo.status === "open" && (
          <Action title="Drop" icon={Icon.MinusCircle} style={Action.Style.Destructive} onAction={drop} />
        )}
        <Action
          title="Delete"
          icon={Icon.Trash}
          style={Action.Style.Destructive}
          shortcut={{
            macOS: { modifiers: ["ctrl"], key: "x" },
            windows: { modifiers: ["ctrl"], key: "x" },
          }}
          onAction={remove}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
