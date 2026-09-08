import { LaunchProps } from "@raycast/api";
import { DayNoteForm } from "./components/day-note-form";
import { withFaite } from "./lib/auth";

/**
 * Today's day note, or another day's via the optional argument.
 *
 * The date is validated here rather than passed through: a malformed segment
 * would 400 at the API, and "2026-13-45" typed by hand deserves a clearer
 * answer than that.
 */
function DayNote(props: LaunchProps<{ arguments: { date?: string } }>) {
  const typed = props.arguments.date?.trim();
  const valid = typed && /^\d{4}-\d{2}-\d{2}$/.test(typed) ? typed : undefined;

  // The machine's date, deliberately, not the account's: this command is
  // reached by a person who means "the day I am having right now", and
  // waiting on /profile to render a form would cost more than it buys.
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return <DayNoteForm date={valid ?? today} />;
}

export default withFaite(DayNote);
