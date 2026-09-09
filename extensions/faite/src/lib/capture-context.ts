import { BrowserExtension, environment, getFrontmostApplication } from "@raycast/api";
import { buildCaptureSource, serializeCaptureSource } from "./capture";

/**
 * Resolves what the user was looking at, ready for `Todo.source`.
 *
 * Split from `capture.ts` because everything here needs Raycast's runtime;
 * the shape-building and truncation next door are testable without it.
 *
 * **Degrades, never fails.** Same rule Quick Add already applies to AI
 * parsing: a to-do captured without context beats a capture that did not
 * happen. Every failure path here returns `undefined` and the caller creates
 * the to-do anyway.
 *
 * Two reasons it may legitimately find nothing:
 *
 * - `BrowserExtension` needs Raycast's browser extension installed. Calling
 *   it without one prompts the user to install it, which is a terrible thing
 *   to do to someone who just wanted to jot a to-do — hence the
 *   `canAccess` gate rather than a try/catch.
 * - The API is **macOS-only** today. On Windows the app name is still
 *   available, so a capture there is `kind: "app"` rather than nothing.
 */
export async function captureContext(): Promise<string | undefined> {
  const [tab, app] = await Promise.all([activeTab(), frontmostApp()]);

  return serializeCaptureSource(
    buildCaptureSource({
      url: tab?.url,
      pageTitle: tab?.title,
      appName: app?.name,
      bundleId: app?.bundleId,
    }),
  );
}

async function activeTab(): Promise<{ url: string; title?: string } | undefined> {
  if (!environment.canAccess(BrowserExtension)) return undefined;

  try {
    const tabs = await BrowserExtension.getTabs();

    // "There can only be one active tab per window but if there are multiple
    // browser windows, there can be multiple active tabs" — and `Tab` carries
    // no focused-window flag, so with two browser windows open this picks the
    // first. Wrong occasionally, and not worth a worse heuristic; the user
    // sees the captured title on the to-do either way.
    const active = tabs.find((candidate) => candidate.active && candidate.url);
    return active ? { url: active.url, title: active.title } : undefined;
  } catch {
    // No browser running, permission declined, extension mid-update.
    return undefined;
  }
}

async function frontmostApp(): Promise<{ name: string; bundleId?: string } | undefined> {
  try {
    const app = await getFrontmostApplication();
    return app.name ? { name: app.name, bundleId: app.bundleId } : undefined;
  } catch {
    return undefined;
  }
}
