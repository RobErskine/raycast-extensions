import { Color, Icon, List as RaycastList } from "@raycast/api";
import { MutatePromise } from "@raycast/utils";
import { deadlineAccessory, priorityAccessory, scheduledAccessory } from "../lib/format";
import type { Label, List, Todo } from "../lib/types";
import { TodoActions } from "./todo-actions";

/**
 * One to-do row, and the empty/loading shell around a set of them.
 *
 * Every list command renders through here so a row looks and behaves the same
 * in Today, Overflow, Search and a list drill-down — the alternative is four
 * action panels that drift apart the first time one gains an action.
 */

interface RowProps {
  todo: Todo;
  today: string;
  lists: List[] | undefined;
  labels: Label[] | undefined;
  mutate: MutatePromise<Todo[] | undefined>;
  /** Shown after the title. Used by Search, where a to-do's list is not
   * implied by the view it is in. */
  showList?: boolean;
  children?: React.ReactNode;
}

const STATUS_ICON: Record<Todo["status"], { source: Icon; tintColor: Color }> = {
  open: { source: Icon.Circle, tintColor: Color.SecondaryText },
  done: { source: Icon.CheckCircle, tintColor: Color.Green },
  dropped: { source: Icon.MinusCircle, tintColor: Color.SecondaryText },
};

export function TodoListItem({ todo, today, lists, labels, mutate, showList, children }: RowProps) {
  const list = lists?.find((l) => l.id === todo.listId);
  const todoLabels = labels?.filter((label) => todo.labelIds.includes(label.id)) ?? [];

  // Order matters: the eye scans right-to-left for urgency, so dates sit
  // outermost and the softer signals (labels, list) sit closer to the title.
  const accessories = [
    ...todoLabels.slice(0, 2).map((label) => ({
      tag: { value: label.name, color: label.color ?? Color.SecondaryText },
    })),
    ...(showList && list ? [{ icon: Icon.List, text: list.name }] : []),
    priorityAccessory(todo.priority),
    scheduledAccessory(todo, today),
    deadlineAccessory(todo, today),
  ].filter((accessory) => accessory !== null);

  return (
    <RaycastList.Item
      key={todo.id}
      icon={STATUS_ICON[todo.status]}
      title={todo.title}
      subtitle={todo.location ?? undefined}
      accessories={accessories}
      // `keywords` is what makes Raycast's own filtering useful on rows whose
      // match lives somewhere other than the title.
      keywords={[list?.name, ...todoLabels.map((l) => l.name), todo.description ?? ""].filter(
        (keyword): keyword is string => Boolean(keyword),
      )}
      actions={
        <TodoActions todo={todo} today={today} lists={lists} mutate={mutate}>
          {children}
        </TodoActions>
      }
    />
  );
}

interface EmptyProps {
  title: string;
  description: string;
  icon?: Icon;
}

export function TodoEmptyView({ title, description, icon = Icon.CheckCircle }: EmptyProps) {
  return <RaycastList.EmptyView icon={icon} title={title} description={description} />;
}
