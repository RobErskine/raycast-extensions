import { Tool } from "@raycast/api";
import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { List } from "../lib/types";

type Input = {
  /** The list's name, as it will appear as a board column. */
  name: string;
  /**
   * What belongs in this list, in plain words. Worth setting: this is the
   * field read when deciding where a new to-do should go, so a list without
   * one is harder to file into later.
   */
  description?: string;
};

/**
 * Create a list (a board column).
 *
 * Check get-lists first — a list with a similar name almost certainly already
 * exists, and a near-duplicate column is worse than filing into the existing
 * one.
 */
export default withFaite(async (input: Input) => api.post<List>("/lists", input));

/** Always confirms: a list is board furniture, not a task, and one created by
 * mistake has to be cleaned up by hand. */
export const confirmation: Tool.Confirmation<Input> = async (input: Input) => ({
  message: `Create a new list called “${input.name}”?`,
  info: [
    { name: "Name", value: input.name },
    ...(input.description ? [{ name: "For", value: input.description }] : []),
  ],
});
