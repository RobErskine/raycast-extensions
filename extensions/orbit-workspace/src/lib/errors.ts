import { openExtensionPreferences, showToast, Toast } from "@raycast/api";

import { isOrbitError } from "../api/problem";

/** A short explanation of an error for a toast or an empty view. */
export function errorMessage(error: unknown): string {
  if (!isOrbitError(error)) return error instanceof Error ? error.message : String(error);
  switch (error.status) {
    case 401:
      return "Orbit did not accept the API token. Check it in the extension preferences.";
    case 403:
      return error.code === "insufficient_scope"
        ? "The API token does not have the permission for this. Give it more access in Orbit under Settings → API tokens."
        : error.detail;
    case 409:
      return error.code === "conflict" ? "Someone changed it at the same time. Refresh and try again." : error.detail;
    case 429:
      return error.retryAfterSeconds
        ? `Too many requests. Try again in ${error.retryAfterSeconds} seconds.`
        : "Too many requests. Try again in a moment.";
    default:
      return error.detail;
  }
}

function needsPreferences(error: unknown): boolean {
  return isOrbitError(error) && (error.status === 401 || error.code === "invalid_url");
}

export async function showError(error: unknown, title: string): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title,
    message: errorMessage(error),
    primaryAction: needsPreferences(error)
      ? { title: "Open Extension Preferences", onAction: () => openExtensionPreferences() }
      : undefined,
  });
}
