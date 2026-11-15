import { getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";

import type { OrbitClient } from "../api/client";
import { getClient, scopeChecker } from "../api/session";
import type { Me, Scope } from "../api/types";

import { useQuery } from "./useQuery";

export interface Orbit {
  client: OrbitClient;
  me: Me;
  workspaceId: string;
  /** Part of every cache key: data of another Orbit or token is never shown. */
  cacheScope: string;
  /** The token's person; null for a service-account token. */
  userId: string | undefined;
  hasScope: (scope: Scope) => boolean;
}

export function useOrbit() {
  let client: OrbitClient | undefined;
  let setupError: unknown;
  try {
    client = getClient();
  } catch (error) {
    setupError = error;
  }
  const { apiToken } = getPreferenceValues<Preferences>();
  const {
    data: me,
    error,
    isLoading,
    revalidate,
  } = useQuery<Me>(["me", client?.base ?? "", apiToken.slice(-6)], () => client!.me(), {
    execute: Boolean(client),
    keepPreviousData: false,
    onError: () => {
      // Guard shows the error.
    },
  });

  const orbit = useMemo<Orbit | undefined>(() => {
    if (!client || !me) return undefined;
    const workspace = me.workspaces[0] ?? { ...me.workspace, scopes: me.token.scopes };
    return {
      client,
      me,
      workspaceId: workspace.id,
      cacheScope: `${client.base}|${me.token.id}|${workspace.id}`,
      userId: me.user?.id,
      hasScope: scopeChecker(workspace.scopes),
    };
  }, [client, me]);

  return { orbit, base: client?.base, error: setupError ?? error, isLoading: isLoading && !me, revalidate };
}

export { getClient, scopeChecker };
