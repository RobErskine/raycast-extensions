import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { Label } from "../lib/types";

/** The caller's labels. Labels are multi-assign tags, not columns — a to-do
 * belongs to exactly one list but can carry any number of labels. */
export default withFaite(async () => api.get<Label[]>("/labels"));
