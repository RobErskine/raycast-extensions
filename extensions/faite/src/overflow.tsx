import { Action, ActionPanel, Icon, List, Keyboard } from "@raycast/api";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { TodoForm } from "./components/todo-form";
import { withFaite } from "./lib/auth";
import { useLabels, useLists, useOverflow, useToday } from "./lib/hooks";

/**
 * Overflow — the Faite Loop's burn-down queue.
 *
 * These are to-dos missed for longer than the account's `overflowAfterDays`
 * allows. The set is derived SERVER-side against the account's own settings,
 * because the rule depends on the board's placement logic and a second
 * implementation here would drift the first time either changed.
 *
 * The endpoint reports placement rather than visibility, so completed items
 * that happen to sit in the overflow window come back too. This is a triage
 * queue, so they are filtered out — what you want here is the work still
 * owed, not a history of the window.
 */
function Overflow() {
  const today = useToday();

  const { data: overflow, isLoading, mutate } = useOverflow();
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  const rows = (overflow ?? []).filter((todo) => todo.status === "open");

  return (
    <List
      actions={
        <ActionPanel>
          <Action.Push title="New To-Do" icon={Icon.Plus} target={<TodoForm mutate={mutate} />} />
        </ActionPanel>
      }
      isLoading={isLoading}
      searchBarPlaceholder="Filter overflow"
    >
      {rows.length === 0 && !isLoading ? (
        <TodoEmptyView
          title="Nothing has slipped"
          description="Everything scheduled is still inside your Faite Loop window."
        />
      ) : (
        <List.Section title="Overflow" subtitle={`${rows.length}`}>
          {rows.map((todo) => (
            <TodoListItem key={todo.id} todo={todo} today={today} lists={lists} labels={labels} mutate={mutate}>
              <Action.Push
                title="New To-Do"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                target={<TodoForm mutate={mutate} />}
              />
            </TodoListItem>
          ))}
        </List.Section>
      )}
    </List>
  );
}

export default withFaite(Overflow);
