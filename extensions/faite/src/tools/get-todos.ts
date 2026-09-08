import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { Todo } from "../lib/types";

type Input = {
  /**
   * Only return to-dos with this status. Defaults to open, which is almost
   * always what a question about "my to-dos" means. Ask for "done" only when
   * the user is reviewing what they finished.
   */
  status?: "open" | "done" | "dropped";
  /**
   * Only return to-dos in this list. This is a list ID, not a name — call
   * get-lists first and match the user's wording against the names there.
   * Never guess an ID.
   */
  listId?: string;
  /**
   * Only return to-dos scheduled for this exact day, as YYYY-MM-DD. Use this
   * for "today", "tomorrow", or a named date. It matches one day only, not a
   * range.
   */
  scheduledDate?: string;
  /**
   * Only return to-dos carrying this label ID. Call get-labels first; never
   * guess an ID.
   */
  labelId?: string;
};

/** Read the caller's to-dos, filtered server-side. */
export default withFaite(async (input: Input) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return api.get<Todo[]>(`/todos${qs ? `?${qs}` : ""}`);
});
