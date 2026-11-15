import { withErrors } from "../ai/context";
import { getClient } from "../api/session";

/** Who the Orbit API token acts as, its workspace, and what it may do. */
export default async function () {
  return withErrors(async () => {
    const client = getClient();
    const me = await client.me();
    const workspace = me.workspaces[0] ?? { ...me.workspace, scopes: me.token.scopes };
    return {
      user: me.user ? { name: me.user.display_name, email: me.user.email } : null,
      serviceAccount: me.service_account?.name ?? null,
      workspace: workspace.name,
      permissions: workspace.scopes,
      orbitUrl: client.base,
    };
  });
}
