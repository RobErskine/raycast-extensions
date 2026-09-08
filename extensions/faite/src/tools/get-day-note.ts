import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { DayNote } from "../lib/types";

type Input = {
  /**
   * The day, as YYYY-MM-DD. Call get-profile first if you need to work out
   * what "today" is — Faite's days are civil dates in the account's own
   * timezone, not the machine's.
   */
  date: string;
};

/**
 * The Markdown note for one day.
 *
 * A day note belongs to the whole DAY. It is not a to-do's notes — those live
 * on the to-do itself, as its description. Every valid date is readable; a
 * day with nothing written returns an empty body rather than an error.
 */
export default withFaite(async ({ date }: Input) => api.get<DayNote>(`/day-notes/${date}`));
