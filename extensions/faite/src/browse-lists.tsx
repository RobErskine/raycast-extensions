import { Action, ActionPanel, Alert, Color, confirmAlert, Icon, List, showToast, Toast, Keyboard } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { withFaite } from "./lib/auth";
import { useLabels, useLists, useToday, useTodos } from "./lib/hooks";
import { api, apiHost } from "./lib/api";
import { ListForm } from "./components/list-form";
import { TodoForm } from "./components/todo-form";
import type { List as FaiteList } from "./lib/types";

/**
 * Browse lists, then drill into one.
 *
 * Archived lists are hidden rather than dimmed: archiving in Faite means "put
 * this away with its to-dos," so surfacing them here would undo the filing
 * decision the user already made.
 */
function ListTodos({ list }: { list: FaiteList }) {
  const today = useToday();

  const { data: todos, isLoading, mutate } = useTodos({ listId: list.id, status: "open" });
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  const rows = todos ?? [];

  return (
    <List
      isLoading={isLoading}
      navigationTitle={list.name}
      searchBarPlaceholder={`Filter ${list.name}`}
      actions={
        <ActionPanel>
          <Action.Push
            title="New To-Do"
            icon={Icon.Plus}
            target={<TodoForm mutate={mutate} defaultListId={list.id} />}
          />
        </ActionPanel>
      }
    >
      {rows.length === 0 && !isLoading ? (
        <TodoEmptyView title={`${list.name} is empty`} description="Nothing open in this list." />
      ) : (
        rows.map((todo) => (
          <TodoListItem key={todo.id} todo={todo} today={today} lists={lists} labels={labels} mutate={mutate}>
            <Action.Push
              title="New To-Do"
              icon={Icon.Plus}
              shortcut={Keyboard.Shortcut.Common.New}
              target={<TodoForm mutate={mutate} defaultListId={list.id} />}
            />
          </TodoListItem>
        ))
      )}
    </List>
  );
}

function BrowseLists() {
  const { data: lists, isLoading, mutate } = useLists();

  const deleteList = async (list: FaiteList) => {
    const confirmed = await confirmAlert({
      title: `Delete “${list.name}”?`,
      // Says what the server actually does. A user who expects the to-dos to
      // go with it would otherwise be surprised in the wrong direction.
      message: "Any to-dos in this list will move to Backlog. This can't be undone from Raycast.",
      icon: { source: Icon.Trash, tintColor: Color.Red },
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    try {
      await mutate(api.del(`/lists/${list.id}`), {
        optimisticUpdate: (data) => data?.filter((l) => l.id !== list.id),
        shouldRevalidateAfter: true,
      });
      await showToast({ style: Toast.Style.Success, title: "List deleted" });
    } catch (error) {
      await showFailureToast(error, { title: "Couldn't delete that list" });
    }
  };
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
                <Action.Push title="Edit List" icon={Icon.Pencil} target={<ListForm list={list} mutate={mutate} />} />
                <Action.Push title="New List" icon={Icon.Plus} target={<ListForm mutate={mutate} />} />
                <Action.OpenInBrowser title="Open in Faite" url={`${apiHost()}/board`} />
                {/* Backlog is where a deleted list's to-dos go, so the server
                    refuses to delete it. Hiding the action is honest; showing
                    one that always 409s is not. */}
                {!list.isBacklog && (
                  <Action
                    title="Delete List"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => deleteList(list)}
                  />
                )}
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

export default withFaite(BrowseLists);
