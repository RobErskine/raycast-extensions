import { Action, ActionPanel, Detail, Icon, List, openExtensionPreferences } from "@raycast/api";
import type { ReactNode } from "react";

import { isOrbitError } from "../api/problem";
import type { Scope } from "../api/types";
import { webUrls } from "../api/url";
import { useOrbit, type Orbit } from "../hooks/useOrbit";
import { errorMessage } from "../lib/errors";

const SCOPE_TITLE: Record<Scope, string> = {
  "tasks:read": "Tasks: Read",
  "tasks:write": "Tasks: Write",
  "docs:read": "Docs: Read",
  "docs:write": "Docs: Write",
  "chat:read": "Chat: Read",
};

interface GuardProps {
  /** The permission the command needs. */
  scope?: Scope;
  /** Shown while Orbit is checked the first time. Default: a loading list. */
  loading?: ReactNode;
  children: (orbit: Orbit) => ReactNode;
}

/** Checks the preferences, the token and its permission before the command renders. */
export function Guard({ scope, loading, children }: GuardProps) {
  const { orbit, base, error, isLoading, revalidate } = useOrbit();

  if (error && (!orbit || (isOrbitError(error) && error.status === 401))) {
    const code = isOrbitError(error) ? error.code : "";
    const title =
      code === "invalid_url"
        ? "Check the Orbit URL"
        : code === "unauthorized"
          ? "Orbit did not accept the API token"
          : code === "network"
            ? "Orbit is not reachable"
            : "Could not connect to Orbit";
    return (
      <Problem
        title={title}
        text={errorMessage(error)}
        onRetry={code === "invalid_url" ? undefined : () => revalidate()}
        tokensUrl={base ? webUrls.apiTokens(base) : undefined}
      />
    );
  }
  if (!orbit)
    return (
      <>{isLoading || !error ? (loading ?? <List isLoading searchBarPlaceholder="Connecting to Orbit…" />) : null}</>
    );

  if (scope && !orbit.hasScope(scope)) {
    const serviceAccount = orbit.me.service_account !== null && scope !== "tasks:read" && scope !== "tasks:write";
    return (
      <Problem
        title={`The API token needs ${SCOPE_TITLE[scope]}`}
        text={
          serviceAccount
            ? `This is a service-account token, and those can use tasks only. Create a personal token with ${SCOPE_TITLE[scope]} in Orbit under Settings → API tokens, and paste it in the extension preferences.`
            : `Create a token with ${SCOPE_TITLE[scope]} in Orbit under Settings → API tokens, and paste it in the extension preferences.`
        }
        tokensUrl={webUrls.apiTokens(orbit.client.base)}
      />
    );
  }
  return <>{children(orbit)}</>;
}

function Problem({
  title,
  text,
  onRetry,
  tokensUrl,
}: {
  title: string;
  text: string;
  onRetry?: () => void;
  tokensUrl?: string;
}) {
  return (
    <Detail
      markdown={`## ${title}\n\n${text}`}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          {tokensUrl && <Action.OpenInBrowser title="Open API Tokens in Orbit" url={tokensUrl} />}
          {onRetry && <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={onRetry} />}
        </ActionPanel>
      }
    />
  );
}
