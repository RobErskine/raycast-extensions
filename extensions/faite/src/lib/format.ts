import { Color, Icon } from "@raycast/api";
import { humanDate, isCivilDate } from "./dates";
import type { Priority, Todo } from "./types";

/**
 * Presentation helpers that need Raycast's `Icon` and `Color`.
 *
 * The civil-date arithmetic these build on lives in `./dates`, which imports
 * nothing — see that file for why the split exists.
 */

const PRIORITY_COLOR: Record<Priority, Color> = {
  urgent: Color.Red,
  high: Color.Orange,
  medium: Color.Yellow,
  low: Color.SecondaryText,
};

export function priorityAccessory(priority: Priority | null) {
  if (!priority) return null;
  return {
    icon: { source: Icon.Exclamationmark, tintColor: PRIORITY_COLOR[priority] },
    tooltip: `Priority: ${priority}`,
  };
}

/**
 * A deadline reads differently from a scheduled date: it is a promise rather
 * than a plan, so an overdue one is colored and a met one is not.
 */
export function deadlineAccessory(todo: Todo, today: string) {
  if (!isCivilDate(todo.deadline)) return null;

  const overdue = todo.deadline < today && todo.status === "open";
  return {
    icon: { source: Icon.Flag, tintColor: overdue ? Color.Red : Color.SecondaryText },
    text: humanDate(todo.deadline, today),
    tooltip: overdue ? `Due ${humanDate(todo.deadline, today)} — overdue` : `Due ${humanDate(todo.deadline, today)}`,
  };
}

export function scheduledAccessory(todo: Todo, today: string) {
  if (!isCivilDate(todo.scheduledDate)) return null;

  const slipped = todo.scheduledDate < today && todo.status === "open";
  return {
    icon: { source: Icon.Calendar, tintColor: slipped ? Color.Orange : Color.SecondaryText },
    text: humanDate(todo.scheduledDate, today),
    tooltip: slipped ? "Scheduled in the past" : "Scheduled",
  };
}
