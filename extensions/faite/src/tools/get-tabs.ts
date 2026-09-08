import { api } from "../lib/api";
import { withFaite } from "../lib/auth";
import type { Tab } from "../lib/types";

/** The caller's tabs — the groups their lists are organized into. */
export default withFaite(async () => api.get<Tab[]>("/tabs"));
