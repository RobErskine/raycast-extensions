import { useState } from "react";
import { Action, ActionPanel, Icon, List, Keyboard } from "@raycast/api";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { TodoForm } from "./components/todo-form";
import { withFaite } from "./lib/auth";
import { useLabels, useLists, useToday, useTodos } from "./lib/hooks";

/**
 * Search across every to-do.
 *
 * Filtering is LOCAL, via Raycast's own `filtering` on the list. The API can
 * filter by status/list/label but has no text search, and round-tripping per
 * keystroke would burn the key's 120-requests-a-minute budget on a single
 * query. So one fetch per status choice, then Raycast narrows it — which is
 * also instant, which is the point of searching from a launcher.
 */
function SearchTodos() {
  const [status, setStatus] = useState<string>("open");

  const today = useToday();

  const { data: todos, isLoading, mutate } = useTodos(status === "all" ? {} : { status });
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  const rows = todos ?? [];

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search to-dos by title, list or label"
      searchBarAccessory={
        <List.Dropdown tooltip="Status" value={status} onChange={setStatus} storeValue>
          <List.Dropdown.Item title="Open" value="open" />
          <List.Dropdown.Item title="Done" value="done" />
          <List.Dropdown.Item title="Dropped" value="dropped" />
          <List.Dropdown.Item title="All" value="all" />
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          <Action.Push title="New To-Do" icon={Icon.Plus} target={<TodoForm mutate={mutate} />} />
        </ActionPanel>
      }
    >
      {rows.length === 0 && !isLoading ? (
        <TodoEmptyView title="No to-dos" description="Nothing matches that status yet." />
      ) : (
        rows.map((todo) => (
          <TodoListItem key={todo.id} todo={todo} today={today} lists={lists} labels={labels} mutate={mutate} showList>
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

export default withFaite(SearchTodos);
