import { api } from "../lib/api";
import type { List, Todo } from "../lib/types";

/**
 * Confirmation dialogs show what the user is about to agree to, so they must
 * show NAMES, not ids. "Delete Buy milk from Errands" is a decision someone
 * can make; "Delete 018f2c…" is not.
 *
 * Each helper fetches only what it needs, and swallows its own failures: a
 * lookup that fails should degrade the dialog's wording, never block the
 * confirmation and strand the user mid-action.
 */

export async function todoTitle(id: string): Promise<string> {
  try {
    return (await api.get<Todo>(`/todos/${id}`)).title;
  } catch {
    return id;
  }
}

export async function listName(id: string | null | undefined): Promise<string | undefined> {
  if (!id) return undefined;
  try {
    return (await api.get<List>(`/lists/${id}`)).name;
  } catch {
    return undefined;
  }
}
