import { Action, ActionPanel, Icon, List, Keyboard } from "@raycast/api";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { TodoForm } from "./components/todo-form";
import { withFaite } from "./lib/auth";
import { useLabels, useLists, useToday, useTodos } from "./lib/hooks";

/**
 * Today's to-dos.
 *
 * "Today" is resolved from the ACCOUNT's timezone, not the machine's — Faite
 * stores `scheduledDate` as a civil date, so a traveller's day is the one
 * their profile says it is. The list stays empty rather than wrong while the
 * profile loads.
 */
function Today() {
  const today = useToday();

  const { data: todos, isLoading, mutate } = useTodos(today ? { scheduledDate: today, status: "open" } : {});
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  // `useToday` starts on the machine's date and re-queries once the account's
  // timezone lands, so this is always a real day's worth of rows — never the
  // unfiltered set that an absent date used to produce.
  const rows = todos ?? [];

  return (
    <List
      actions={
        <ActionPanel>
          <Action.Push title="New To-Do" icon={Icon.Plus} target={<TodoForm mutate={mutate} />} />
        </ActionPanel>
      }
      isLoading={isLoading}
      searchBarPlaceholder="Filter today's to-dos"
    >
      {rows.length === 0 && !isLoading ? (
        <TodoEmptyView title="Nothing scheduled for today" description="Enjoy it, or pull something out of Backlog." />
      ) : (
        rows.map((todo) => (
          <TodoListItem key={todo.id} todo={todo} today={today} lists={lists} labels={labels} mutate={mutate}>
            <Action.Push
              title="New To-Do"
              icon={Icon.Plus}
              shortcut={Keyboard.Shortcut.Common.New}
              target={<TodoForm mutate={mutate} />}
            />
          </TodoListItem>
        ))
      )}
    </List>
  );
}

export default withFaite(Today);
