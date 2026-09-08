import { Tool } from "@raycast/api";
import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { DayNote } from "../lib/types";

type Input = {
  /** The day, as YYYY-MM-DD. */
  date: string;
  /**
   * The full Markdown body. This REPLACES whatever is there — it does not
   * append. Call get-day-note first and include the existing text if the user
   * is adding to a note rather than rewriting it. An empty string clears it.
   */
  body: string;
};

/** Write the Markdown note for one day. */
export default withFaite(async ({ date, body }: Input) => api.put<DayNote>(`/day-notes/${date}`, { body }));

/**
 * Always confirms, because this REPLACES the whole note. A model that meant
 * to append but sent only the new text would silently destroy whatever was
 * there, and the user is the only one who can catch that.
 */
export const confirmation: Tool.Confirmation<Input> = withFaite(async ({ date, body }: Input) => {
  let existing = "";
  try {
    existing = (await api.get<DayNote>(`/day-notes/${date}`)).body;
  } catch {
    // Treat an unreadable note as empty — the dialog still needs to appear.
  }

  return {
    message: body.trim()
      ? existing.trim()
        ? `Replace the note for ${date}?`
        : `Write the note for ${date}?`
      : `Clear the note for ${date}?`,
    info: [
      { name: "Day", value: date },
      ...(existing.trim() ? [{ name: "Replacing", value: `${existing.length} characters` }] : []),
      ...(body.trim() ? [{ name: "New note", value: body.slice(0, 200) }] : []),
    ],
  };
});
