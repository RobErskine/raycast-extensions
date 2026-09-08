import { Action, ActionPanel, Detail, LaunchProps, open, popToRoot, showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useState } from "react";
import { apiHost } from "./lib/api";
import { clearStoredToken, preferenceToken, storedToken, storeToken } from "./lib/auth";

/**
 * Both halves of connecting an account.
 *
 * Launched normally, it explains the two options and opens the browser.
 * Launched from the `/raycast-handoff` deep link, it arrives with a
 * `launchContext` carrying a one-time code, trades it for the real API key,
 * and stores it.
 *
 * `launchContext` rather than `arguments`: Raycast only forwards its
 * documented query params (`launchType`, `arguments`, `context`,
 * `fallbackText`), and `context` is the one that needs no matching argument
 * declared in the manifest. An arbitrary `?code=` would be dropped silently.
 */

type Status = "idle" | "exchanging" | "connected" | "error";

interface ConnectContext {
  code?: string;
}

async function exchangeCode(code: string): Promise<string> {
  const response = await fetch(`${apiHost()}/api/raycast/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    // The code is TTL-bounded (60s), so "expired" is the overwhelmingly
    // likely cause and worth naming rather than reporting a bare 401.
    throw new Error(
      response.status === 401
        ? "That sign-in code was already used or has expired. Start the connection again."
        : `Faite couldn't complete the connection (${response.status}).`,
    );
  }

  const body = (await response.json()) as { token: string };
  return body.token;
}

export default function ConnectAccount(props: LaunchProps<{ launchContext?: ConnectContext }>) {
  const code = props.launchContext?.code;
  const [status, setStatus] = useState<Status>(code ? "exchanging" : "idle");
  const [alreadyConnected, setAlreadyConnected] = useState(false);

  useEffect(() => {
    void storedToken().then((token) => setAlreadyConnected(Boolean(token)));
  }, [status]);

  useEffect(() => {
    if (!code) return;
    let canceled = false;

    void exchangeCode(code)
      .then(async (token) => {
        if (canceled) return;
        await storeToken(token);
        setStatus("connected");
        await showToast({ style: Toast.Style.Success, title: "Faite connected" });
        await popToRoot();
      })
      .catch(async (error) => {
        if (canceled) return;
        setStatus("error");
        await showFailureToast(error, { title: "Couldn't connect Faite" });
      });

    return () => {
      canceled = true;
    };
  }, [code]);

  if (status === "exchanging") {
    // A braced template literal, not a plain JSX string attribute: JSX does
    // not process escapes, so `"...\n..."` would render a literal backslash-n.
    return <Detail isLoading markdown={"# Connecting…\n\nTrading your sign-in code for an API key."} />;
  }

  const pasted = preferenceToken();
  const markdown = [
    "# Connect Faite",
    "",
    pasted
      ? "You have an API key set in this extension's preferences. That key is used for everything, and it overrides a connected account."
      : alreadyConnected
        ? "Your Faite account is connected. You can reconnect at any time — it mints a fresh key and replaces the old one."
        : "Faite isn't connected yet. Sign in through your browser and Raycast will be handed a key automatically.",
    "",
    "---",
    "",
    "**Prefer to paste a key?** Mint one in Faite under Settings → API Keys with **Write** enabled, then put it in this extension's preferences.",
  ].join("\n");

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title={alreadyConnected ? "Reconnect in Browser" : "Connect in Browser"}
            onAction={() => open(`${apiHost()}/raycast-handoff`)}
          />
          {alreadyConnected && (
            <Action
              title="Disconnect"
              style={Action.Style.Destructive}
              onAction={async () => {
                await clearStoredToken();
                setAlreadyConnected(false);
                await showToast({ style: Toast.Style.Success, title: "Disconnected" });
              }}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
