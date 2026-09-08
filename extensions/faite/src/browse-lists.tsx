import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { withFaite } from "./lib/auth";
import { todayIn } from "./lib/format";
import { useLabels, useLists, useProfile, useTodos } from "./lib/hooks";
import { apiHost } from "./lib/api";
import type { List as FaiteList } from "./lib/types";

/**
 * Browse lists, then drill into one.
 *
 * Archived lists are hidden rather than dimmed: archiving in Faite means "put
 * this away with its to-dos," so surfacing them here would undo the filing
 * decision the user already made.
 */
function ListTodos({ list }: { list: FaiteList }) {
  const { data: profile } = useProfile();
  const today = profile ? todayIn(profile.timezone) : "";

  const { data: todos, isLoading, mutate } = useTodos({ listId: list.id, status: "open" });
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  const rows = todos ?? [];

  return (
    <List isLoading={isLoading} navigationTitle={list.name} searchBarPlaceholder={`Filter ${list.name}`}>
      {rows.length === 0 && !isLoading ? (
        <TodoEmptyView title={`${list.name} is empty`} description="Nothing open in this list." />
      ) : (
        rows.map((todo) => (
          <TodoListItem key={todo.id} todo={todo} today={today} lists={lists} labels={labels} mutate={mutate} />
        ))
      )}
    </List>
  );
}

function BrowseLists() {
  const { data: lists, isLoading } = useLists();
  const visible = (lists ?? []).filter((list) => !list.archivedAt);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search lists">
      {visible.length === 0 && !isLoading ? (
        <TodoEmptyView icon={Icon.List} title="No lists" description="Create one in Faite to get started." />
      ) : (
        visible.map((list) => (
          <List.Item
            key={list.id}
            icon={
              list.emoji
                ? { source: Icon.Circle, tintColor: list.color ?? Color.SecondaryText }
                : { source: list.isBacklog ? Icon.Tray : Icon.List, tintColor: list.color ?? Color.SecondaryText }
            }
            title={list.name}
            subtitle={list.description ?? undefined}
            accessories={list.isBacklog ? [{ tag: "Backlog" }] : []}
            actions={
              <ActionPanel>
                <Action.Push title="Show To-Dos" icon={Icon.ArrowRight} target={<ListTodos list={list} />} />
                <Action.OpenInBrowser title="Open in Faite" url={`${apiHost()}/board`} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

export default withFaite(BrowseLists);
