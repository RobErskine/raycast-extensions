/**
 * Civil-date arithmetic. **Deliberately imports nothing** — not
 * `@raycast/api`, not the API client, nothing.
 *
 * Split out of `format.ts` (which needs `Icon`/`Color`) so it can be tested
 * with plain `node --test`, outside Raycast's runtime. Same reasoning the
 * Faite repo uses for splitting `hlc-core.ts` from `hlc.ts`: the logic worth
 * testing should not be reachable only through a runtime you cannot start in
 * a test.
 *
 * Faite stores scheduled dates as CIVIL dates — `YYYY-MM-DD`, meaning that
 * calendar day where the user lives, not an instant. Every function here
 * takes a string that came from the network or from a hook that may not have
 * resolved yet, so none of them may assume well-formed input, and none of
 * them may throw. EI-309 is what happens when one does.
 */

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A real calendar day, not merely something shaped like one.
 *
 * The round-trip check is the point: `Date.UTC` happily ROLLS OVER, so
 * "2026-13-45" becomes 2027-02-15 and "2026-02-30" becomes March 2nd. Both
 * match the pattern, and both would sail through a regex-only check to
 * produce a confidently wrong date somewhere downstream. Reconstructing the
 * string and comparing is the cheapest way to catch that.
 */
export function isCivilDate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !CIVIL_DATE.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Today as a civil date in the ACCOUNT's timezone, not the machine's.
 *
 * Using the laptop's clock would put a traveller's to-dos on the wrong day,
 * and the profile carries `timezone` precisely so a client does not guess.
 *
 * `en-CA` because its short date format is already `YYYY-MM-DD`.
 */
export function todayIn(timezone: string, now: Date = new Date()): string {
  const parts = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, ...parts }).format(now);
  } catch {
    // An unknown IANA zone throws. The machine's own date is wrong-ish but
    // harmless, and far better than rendering nothing.
    return new Intl.DateTimeFormat("en-CA", parts).format(now);
  }
}

/**
 * A civil date `n` days from `date`. Built from UTC parts so a DST boundary
 * cannot shift the result by a day.
 *
 * Returns `null` rather than throwing on anything that is not a civil date.
 * The empty-string case is what crashed Browse Lists (EI-309):
 * `"".split("-").map(Number)` is `[NaN]`, which makes an Invalid Date, and
 * `toISOString()` throws `RangeError` from inside a render.
 */
export function addDays(date: string, days: number): string | null {
  if (!isCivilDate(date)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  if (Number.isNaN(shifted.getTime())) return null;

  return shifted.toISOString().slice(0, 10);
}

/**
 * "Today", "Tomorrow", "Yesterday", or a short human date.
 *
 * Degrades to the raw string for anything unparseable — still readable, and a
 * date that renders oddly is not worth taking a view down for.
 */
export function humanDate(date: string, today: string): string {
  if (!isCivilDate(date)) return date;

  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    // Only show a year when it is not the current one — "Sep 8, 2027" is
    // useful, "Sep 8, 2026" on every row is noise.
    ...(String(year) === today.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(parsed);
}

/** A local `Date` from a picker, as a civil date. Taken from local Y-M-D
 * rather than `toISOString()`, which would shift a late-evening pick to the
 * next day in UTC. */
export function toCivilDate(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A civil date as a `Date` for a picker. Parsed at UTC noon so no timezone
 * can drag the rendered day across midnight. */
export function fromCivilDate(value: string | null | undefined): Date | null {
  if (!isCivilDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
