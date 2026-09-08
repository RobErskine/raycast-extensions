import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { List } from "../lib/types";

/**
 * The caller's lists (the board's columns).
 *
 * Each list's `description` says what belongs in it. Read it before deciding
 * where a new to-do should go — that is the field's entire purpose. `isBacklog`
 * marks the fallback list a to-do lands in when it is not filed anywhere else.
 */
export default withFaite(async () => api.get<List[]>("/lists"));
