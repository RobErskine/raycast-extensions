import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { Profile } from "../lib/types";

/**
 * The caller's account settings.
 *
 * `timezone` is the important one: Faite stores scheduled dates as civil
 * dates, so "today" means the calendar day in THIS timezone, not the
 * machine's. Read it before computing any date.
 */
export default withFaite(async () => api.get<Profile>("/profile"));
