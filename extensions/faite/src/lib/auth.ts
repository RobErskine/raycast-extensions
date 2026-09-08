import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { withAccessToken } from "@raycast/utils";

/**
 * Faite has two ways to authenticate, and both land in the same place: a
 * `faite_…` bearer key with `read` and `write` scope.
 *
 * 1. **Paste a key.** Mint one in Faite → Settings → API Keys and put it in
 *    this extension's preferences. Wins over anything stored, so it is also
 *    the escape hatch if a connected account ever misbehaves.
 * 2. **Connect in the browser.** The `Connect Faite Account` command opens
 *    `/raycast-handoff`, the user signs in normally, and the page hands a
 *    short-lived code back through a `raycast://` deep link. The command
 *    trades that code for the real key and stores it here.
 *
 * `authorize` deliberately does NOT start the browser flow. That flow needs
 * the user to leave Raycast, sign in, and come back through a deep link —
 * it cannot resolve inside a single `authorize()` call, and pretending
 * otherwise would hang every command that touched it. So `authorize` reads
 * what is already stored and, failing that, says exactly which command to
 * run. See `connect-account.tsx`.
 */

const TOKEN_KEY = "faite-api-token";

interface Preferences {
  apiKey?: string;
  apiHost?: string;
}

/** The pasted key, if there is one. Trimmed, because a copy-paste that picks
 * up a trailing newline would otherwise fail as an opaque 401. */
export function preferenceToken(): string | undefined {
  const pasted = getPreferenceValues<Preferences>().apiKey?.trim();
  return pasted ? pasted : undefined;
}

export async function storeToken(token: string): Promise<void> {
  await LocalStorage.setItem(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  await LocalStorage.removeItem(TOKEN_KEY);
}

export async function storedToken(): Promise<string | undefined> {
  return LocalStorage.getItem<string>(TOKEN_KEY);
}

/** Read by every command through `withFaite`. Throws with an actionable
 * message rather than returning empty, so a command never issues a request it
 * already knows will 401. */
async function authorize(): Promise<string> {
  const token = await storedToken();
  if (token) return token;

  throw new Error(
    "Faite isn't connected yet. Run the “Connect Faite Account” command, or paste an API key in this extension's preferences.",
  );
}

/**
 * Wraps a command or an AI tool. `personalAccessToken` takes precedence when
 * set, which is what makes the pasted key an override rather than a rival
 * source of truth.
 *
 * Read the resulting token with `getAccessToken()` from `@raycast/utils` —
 * it is not injected into props.
 */
export const withFaite = withAccessToken({
  authorize,
  personalAccessToken: preferenceToken(),
});
