import { Action, ActionPanel, Icon, List, Keyboard } from "@raycast/api";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { TodoForm } from "./components/todo-form";
import { withFaite } from "./lib/auth";
import { todayIn } from "./lib/format";
import { useLabels, useLists, useProfile, useTodos } from "./lib/hooks";

/**
 * Today's to-dos.
 *
 * "Today" is resolved from the ACCOUNT's timezone, not the machine's — Faite
 * stores `scheduledDate` as a civil date, so a traveller's day is the one
 * their profile says it is. The list stays empty rather than wrong while the
 * profile loads.
 */
function Today() {
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const today = profile ? todayIn(profile.timezone) : undefined;

  const { data: todos, isLoading, mutate } = useTodos(today ? { scheduledDate: today, status: "open" } : {});
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  // Without a resolved timezone the query above is unfiltered, so suppress
  // the rows rather than briefly showing every open to-do as "today".
  const rows = today ? (todos ?? []) : [];

  return (
    <List
      actions={
        <ActionPanel>
          <Action.Push title="New To-Do" icon={Icon.Plus} target={<TodoForm mutate={mutate} />} />
        </ActionPanel>
      }
      isLoading={loadingProfile || isLoading}
      searchBarPlaceholder="Filter today's to-dos"
    >
      {rows.length === 0 && !isLoading && !loadingProfile ? (
        <TodoEmptyView title="Nothing scheduled for today" description="Enjoy it, or pull something out of Backlog." />
      ) : (
        rows.map((todo) => (
          <TodoListItem key={todo.id} todo={todo} today={today!} lists={lists} labels={labels} mutate={mutate}>
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
