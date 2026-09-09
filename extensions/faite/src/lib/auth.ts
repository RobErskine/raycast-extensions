import { getPreferenceValues, OAuth } from "@raycast/api";
import { withAccessToken } from "@raycast/utils";
import { normalizeHost } from "./errors";

/**
 * Faite has two ways to authenticate, and both end at the same `faite_…`
 * bearer key with `read` and `write` scope.
 *
 * 1. **Sign in through the browser.** Raycast drives this: it shows its own
 *    sign-in overlay, opens Faite, stores the token, and — the reason this is
 *    a `PKCEClient` at all — renders a **"Logged into Faite / Logout" row in
 *    the extension's settings**. That row is Raycast's, not ours; an
 *    extension gets it by authenticating through `OAuth.PKCEClient` and
 *    calling `setTokens`, and by no other means. An earlier version used a
 *    "Connect Account" command instead, which no other extension does.
 * 2. **Paste a key.** Mint one in Faite → Settings → API Keys. Passed as
 *    `personalAccessToken`, so it WINS over a signed-in session — which makes
 *    it a genuine override, and the escape hatch if a connection misbehaves.
 *
 * ## This is OAuth-shaped, not OAuth
 *
 * Faite is not an authorization server. `/raycast-handoff` accepts the
 * standard params, ignores `code_challenge`, and redirects back with a code
 * that is really an encrypted, 60-second, single-account handoff envelope.
 * `clientId` is a label, not a registered credential.
 *
 * That is a deliberate trade: the flow's security comes from the code being
 * encrypted under a server secret, short-lived, mintable only with a live
 * cookie session, and deliverable only to `https://raycast.com/redirect` —
 * not from PKCE. Said plainly here so nobody reads `PKCEClient` and assumes
 * guarantees that are not there.
 */

const DEFAULT_HOST = "https://myfaite.app";

interface Preferences {
  apiKey?: string;
  apiHost?: string;
}

/** Duplicated from `api.ts` rather than imported: that module reads the
 * access token at call time, and importing it here would make the auth layer
 * depend on the thing it authenticates. */
function host(): string {
  return normalizeHost(getPreferenceValues<Preferences>().apiHost, DEFAULT_HOST);
}

/** The pasted key, if there is one. Trimmed, because a paste that picks up a
 * trailing newline would otherwise fail as an opaque 401. */
export function preferenceToken(): string | undefined {
  const pasted = getPreferenceValues<Preferences>().apiKey?.trim();
  return pasted ? pasted : undefined;
}

const client = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Faite",
  providerIcon: "extension-icon.png",
  description: "Connect your Faite account",
});

/**
 * Trades the one-time code for the real API key.
 *
 * Not a standard OAuth token endpoint — it takes JSON, returns `{ token }`,
 * and ignores `code_verifier`. See this file's header.
 */
async function exchange(code: string): Promise<string> {
  const response = await fetch(`${host()}/api/raycast/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    // The code lives 60 seconds, so "expired" is overwhelmingly the likely
    // cause and worth naming rather than reporting a bare 401.
    throw new Error(
      response.status === 401
        ? "That sign-in code was already used or has expired. Try connecting again."
        : `Faite couldn't complete the sign-in (${response.status}).`,
    );
  }

  return ((await response.json()) as { token: string }).token;
}

/**
 * Returns a stored token when there is one, and otherwise runs the browser
 * flow. Raycast calls this on demand, which is why no command needs to check
 * whether the user is signed in first.
 */
async function authorize(): Promise<string> {
  const existing = await client.getTokens();
  if (existing?.accessToken) return existing.accessToken;

  const request = await client.authorizationRequest({
    endpoint: `${host()}/raycast-handoff`,
    // A label. Faite has no client registry — see this file's header.
    clientId: "raycast",
    scope: "read write",
  });

  const { authorizationCode } = await client.authorize(request);
  const token = await exchange(authorizationCode);

  // Storing the token set is what makes Raycast render the logout row.
  await client.setTokens({ accessToken: token });

  return token;
}

/**
 * Wraps every command and AI tool. Read the token with `getAccessToken()`
 * from `@raycast/utils` — it is not injected into props.
 */
export const withFaite = withAccessToken({
  client,
  authorize,
  personalAccessToken: preferenceToken(),
});
