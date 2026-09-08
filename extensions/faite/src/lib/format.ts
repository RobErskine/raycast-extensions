import { Color, Icon } from "@raycast/api";
import type { Priority, Todo } from "./types";

/**
 * Presentation helpers. Kept apart from `api.ts` so they stay pure and
 * trivially checkable — none of this touches the network.
 */

/**
 * Today as a civil date (`YYYY-MM-DD`) in the ACCOUNT's timezone, not the
 * machine's.
 *
 * Faite stores `scheduledDate` as a civil date, which means "that calendar
 * day where the user lives" rather than an instant. Using the laptop's clock
 * would put a traveller's to-dos on the wrong day — and the profile carries
 * `timezone` precisely so a client does not have to guess.
 *
 * `en-CA` because its short date format is already `YYYY-MM-DD`; formatting
 * to parts and reassembling would be the same result with more code.
 */
export function todayIn(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // An unknown IANA zone throws. Falling back to the machine's own date is
    // wrong-ish but harmless, and far better than rendering nothing.
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
}

/** A civil date `n` days from `from`, still as a civil date. Built from UTC
 * parts so a DST boundary cannot shift the result by a day. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** "Today", "Tomorrow", "Yesterday", or a short human date. */
export function humanDate(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    // Only show a year when it is not the current one — "Sep 8, 2027" is
    // useful, "Sep 8, 2026" on every row is noise.
    ...(String(year) === today.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(parsed);
}

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
  if (!todo.deadline) return null;

  const overdue = todo.deadline < today && todo.status === "open";
  return {
    icon: { source: Icon.Flag, tintColor: overdue ? Color.Red : Color.SecondaryText },
    text: humanDate(todo.deadline, today),
    tooltip: overdue ? `Due ${humanDate(todo.deadline, today)} — overdue` : `Due ${humanDate(todo.deadline, today)}`,
  };
}

export function scheduledAccessory(todo: Todo, today: string) {
  if (!todo.scheduledDate) return null;

  const slipped = todo.scheduledDate < today && todo.status === "open";
  return {
    icon: { source: Icon.Calendar, tintColor: slipped ? Color.Orange : Color.SecondaryText },
    text: humanDate(todo.scheduledDate, today),
    tooltip: slipped ? "Scheduled in the past" : "Scheduled",
  };
}
