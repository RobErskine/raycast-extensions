import { Action, ActionPanel, Color, Icon, LaunchProps, List, Keyboard } from "@raycast/api";
import { createDeeplink } from "@raycast/utils";
import { TodoEmptyView, TodoListItem } from "./components/todo-list";
import { TodoForm } from "./components/todo-form";
import { ListForm } from "./components/list-form";
import { withFaite } from "./lib/auth";
import { api, apiHost } from "./lib/api";
import { useLabels, useLists, useOverflow, useToday, useTodos } from "./lib/hooks";
import type { List as FaiteList, Todo } from "./lib/types";
import { Alert, confirmAlert, showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";

/**
 * Everything list-shaped, behind one command.
 *
 * Today and Overflow used to be their own commands. They are views over the
 * same to-dos, and a private Raycast organization on the free plan gets five
 * commands total — so they live here as saved views instead, reachable in one
 * keystroke via the `view` argument and in zero via a deep link.
 *
 * That turns out to be better than the split anyway: "what's today, what
 * slipped, what's in Errands" is one question asked three ways, and it now
 * has one place to ask it.
 */

type ViewId = "today" | "overflow" | "backlog";

interface Arguments {
  /** Set by a deep link or picked in the launcher; empty shows the index. */
  view?: string;
}

/** A saved view's identity, kept in one table so the index row, the drilled-in
 * screen and the deep link cannot describe it differently. */
const VIEWS: Record<ViewId, { title: string; icon: Icon; empty: string }> = {
  today: {
    title: "Today",
    icon: Icon.Calendar,
    empty: "Nothing scheduled for today — enjoy it, or pull something out of Backlog.",
  },
  overflow: {
    title: "Overflow",
    icon: Icon.Clock,
    empty: "Nothing has slipped. Everything scheduled is still inside your Faite Loop window.",
  },
  backlog: {
    title: "Backlog",
    icon: Icon.Tray,
    empty: "Backlog is empty.",
  },
};

/** Actions shared by every row and every empty view, so ⌘N works everywhere. */
function NewTodoAction({ listId, mutate }: { listId?: string; mutate: ReturnType<typeof useTodos>["mutate"] }) {
  return (
    <Action.Push
      title="New To-Do"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<TodoForm mutate={mutate} defaultListId={listId} />}
    />
  );
}

/** One saved view, or one real list — the rendering is identical once the
 * to-dos are resolved, so this takes them rather than fetching per variant. */
function TodoScreen({
  title,
  todos,
  isLoading,
  mutate,
  emptyDescription,
  defaultListId,
}: {
  title: string;
  todos: Todo[];
  isLoading: boolean;
  mutate: ReturnType<typeof useTodos>["mutate"];
  emptyDescription: string;
  defaultListId?: string;
}) {
  const today = useToday();
  const { data: lists } = useLists();
  const { data: labels } = useLabels();

  return (
    <List
      isLoading={isLoading}
      navigationTitle={title}
      searchBarPlaceholder={`Filter ${title}`}
      actions={
        <ActionPanel>
          <NewTodoAction listId={defaultListId} mutate={mutate} />
        </ActionPanel>
      }
    >
      {todos.length === 0 && !isLoading ? (
        <TodoEmptyView title={`${title} is clear`} description={emptyDescription} />
      ) : (
        todos.map((todo) => (
          <TodoListItem key={todo.id} todo={todo} today={today} lists={lists} labels={labels} mutate={mutate} showList>
            <NewTodoAction listId={defaultListId} mutate={mutate} />
          </TodoListItem>
        ))
      )}
    </List>
  );
}

function SavedView({ view }: { view: ViewId }) {
  const today = useToday();
  const meta = VIEWS[view];

  // Overflow is derived server-side against the account's own settings, so it
  // has its own endpoint. Today and Backlog are ordinary filters.
  const overflow = useOverflow();
  const scoped = useTodos(
    view === "today" ? { scheduledDate: today, status: "open" } : view === "backlog" ? { status: "open" } : {},
  );
  const { data: lists } = useLists();

  if (view === "overflow") {
    // Placement, not visibility — the endpoint includes completed to-dos that
    // sit in the window. A triage queue wants what is still owed.
    const rows = (overflow.data ?? []).filter((todo) => todo.status === "open");
    return (
      <TodoScreen
        title={meta.title}
        todos={rows}
        isLoading={overflow.isLoading}
        mutate={overflow.mutate}
        emptyDescription={meta.empty}
      />
    );
  }

  const backlogId = lists?.find((list) => list.isBacklog)?.id;
  const rows =
    view === "backlog" ? (scoped.data ?? []).filter((todo) => todo.listId === backlogId) : (scoped.data ?? []);

  return (
    <TodoScreen
      title={meta.title}
      todos={rows}
      isLoading={scoped.isLoading}
      mutate={scoped.mutate}
      emptyDescription={meta.empty}
      defaultListId={view === "backlog" ? backlogId : undefined}
    />
  );
}

function ListScreen({ list }: { list: FaiteList }) {
  const { data, isLoading, mutate } = useTodos({ listId: list.id, status: "open" });

  return (
    <TodoScreen
      title={list.name}
      todos={data ?? []}
      isLoading={isLoading}
      mutate={mutate}
      emptyDescription="Nothing open in this list."
      defaultListId={list.id}
    />
  );
}

function Index() {
  const today = useToday();
  const { data: lists, isLoading, mutate } = useLists();
  const { data: openTodos, isLoading: loadingCounts, mutate: mutateTodos } = useTodos({ status: "open" });
  const { data: overflow } = useOverflow();

  const visible = (lists ?? []).filter((list) => !list.archivedAt);
  const backlogId = visible.find((list) => list.isBacklog)?.id;

  const perList = new Map<string, number>();
  let todayCount = 0;
  for (const todo of openTodos ?? []) {
    if (todo.listId) perList.set(todo.listId, (perList.get(todo.listId) ?? 0) + 1);
    if (todo.scheduledDate === today) todayCount += 1;
  }
  const counts: Record<ViewId, number> = {
    today: todayCount,
    overflow: (overflow ?? []).filter((todo) => todo.status === "open").length,
    backlog: backlogId ? (perList.get(backlogId) ?? 0) : 0,
  };

  /** Suppressed until the counts land rather than showing "0" — an empty list
   * and a list still loading look identical otherwise, which defeats the point
   * of the badge. */
  const countAccessory = (count: number) =>
    loadingCounts ? [] : [{ text: String(count), tooltip: countTooltip(count) }];

  const deleteList = async (list: FaiteList) => {
    const confirmed = await confirmAlert({
      title: `Delete “${list.name}”?`,
      // What the server actually does. A user expecting the to-dos to go with
      // it would be surprised in the wrong direction.
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

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search views and lists">
      <List.Section title="Views">
        {(Object.keys(VIEWS) as ViewId[]).map((view) => (
          <List.Item
            key={view}
            icon={VIEWS[view].icon}
            title={VIEWS[view].title}
            accessories={countAccessory(counts[view])}
            actions={
              <ActionPanel>
                <Action.Push title="Open" icon={Icon.ArrowRight} target={<SavedView view={view} />} />
                {/* These were standalone commands before the consolidation.
                    A deep link plus a Quicklink hotkey gets them back to
                    one keystroke without spending a command slot. */}
                <Action.CreateQuicklink
                  title={`Create Quicklink to ${VIEWS[view].title}`}
                  quicklink={{
                    name: `Faite — ${VIEWS[view].title}`,
                    link: createDeeplink({ command: "my-lists", arguments: { view } }),
                  }}
                />
                <Action.CopyToClipboard
                  title="Copy Deeplink"
                  content={createDeeplink({ command: "my-lists", arguments: { view } })}
                />
                <NewTodoAction mutate={mutateTodos} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Lists">
        {visible.map((list) => (
          <List.Item
            key={list.id}
            icon={{
              source: list.isBacklog ? Icon.Tray : Icon.List,
              tintColor: list.color ?? Color.SecondaryText,
            }}
            title={list.name}
            subtitle={list.description ?? undefined}
            accessories={countAccessory(perList.get(list.id) ?? 0)}
            actions={
              <ActionPanel>
                <Action.Push title="Show To-Dos" icon={Icon.ArrowRight} target={<ListScreen list={list} />} />
                <NewTodoAction listId={list.id} mutate={mutateTodos} />
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
        ))}
      </List.Section>
    </List>
  );
}

/** Written out rather than `${n} open to-do(s)` — a parenthesised plural in a
 * tooltip reads like a form field. */
function countTooltip(count: number): string {
  if (count === 0) return "Nothing open";
  return count === 1 ? "1 open to-do" : `${count} open to-dos`;
}

function MyLists(props: LaunchProps<{ arguments: Arguments }>) {
  const view = props.arguments?.view;

  // Branching in the wrapper, not inside a component that also calls hooks —
  // the two paths render different hook sets, so they have to be separate
  // components rather than one with an early return.
  return view && view in VIEWS ? <SavedView view={view as ViewId} /> : <Index />;
}

export default withFaite(MyLists);
