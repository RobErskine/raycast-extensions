/**
 * "Where were you when you captured this" — the blob Faite stores in
 * `Todo.source`.
 *
 * **Hand-mirrors `src/lib/capture-source.ts` in the Faite repo**, which is
 * the source of truth for this shape. Different repo, so it cannot be
 * imported; keep the two in sync by hand, the way Faite's own service layer
 * mirrors `CreateTodoInput` across its DOM-free boundary.
 *
 * The pure half lives here so it is testable. The IO half — asking Raycast
 * which tab is open — is in `capture-context.ts`, which cannot be imported
 * outside Raycast's runtime.
 */

/** Faite's `CAPTURE_SOURCE_MAX_BYTES`. The blob crosses the sync wire on
 * every push of the to-do it is attached to, and **the server does not
 * truncate on the `/api/v1` path** — so a long URL plus a long page title
 * has to be bounded here or the write is rejected. */
export const CAPTURE_SOURCE_MAX_BYTES = 2048;

export interface CaptureSource {
  /** Schema version. Faite branches on this before reading any other field. */
  v: 1;
  /** `"browser"` and `"app"` are the kinds Faite's badge renders today.
   * Deliberately a string, not a union: Faite types it open so a client
   * shipped later can introduce a kind without older clients rejecting it. */
  kind: string;
  /** ISO instant — the moment of CAPTURE, not the to-do's `createdAt`. */
  at: string;
  app?: { name: string; bundleId?: string };
  url?: string;
  pageTitle?: string;
}

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

export interface CaptureInput {
  url?: string;
  pageTitle?: string;
  appName?: string;
  bundleId?: string;
  at?: string;
}

/**
 * Builds the blob, or `undefined` when there is no context worth recording.
 *
 * Returns undefined rather than an empty capture on purpose: a blob with a
 * timestamp and nothing else would render as "Captured" in Faite, implying
 * context that was never collected. No context and no badge is the honest
 * result.
 *
 * **`window.title` is deliberately never captured.** An app window title is
 * the invasive, low-value half — "Re: layoffs — Mail" is not something anyone
 * wants silently attached to a to-do. `pageTitle` covers the useful case, and
 * only for a real browser tab.
 */
export function buildCaptureSource(input: CaptureInput): CaptureSource | undefined {
  const url = input.url?.trim() || undefined;
  const appName = input.appName?.trim() || undefined;
  if (!url && !appName) return undefined;

  return {
    v: 1,
    // A URL makes it a browser capture; otherwise it is just "which app was
    // in front". Faite's badge renders these differently.
    kind: url ? "browser" : "app",
    at: input.at ?? new Date().toISOString(),
    ...(url ? { url } : {}),
    ...(input.pageTitle?.trim() ? { pageTitle: input.pageTitle.trim() } : {}),
    ...(appName ? { app: { name: appName, ...(input.bundleId ? { bundleId: input.bundleId } : {}) } } : {}),
  };
}

/**
 * Serializes, dropping the page title first if the blob is too large.
 *
 * Mirrors Faite's own truncation ladder in spirit: `pageTitle` is the long field
 * and the most expendable — a URL you can click beats a title you can read.
 * If it is still too large after that, the URL itself is the problem, and a
 * capture is dropped entirely rather than sending a write the server will
 * reject.
 */
export function serializeCaptureSource(source: CaptureSource | undefined): string | undefined {
  if (!source) return undefined;

  const full = JSON.stringify(source);
  if (byteLength(full) <= CAPTURE_SOURCE_MAX_BYTES) return full;

  const withoutTitle = JSON.stringify({ ...source, pageTitle: undefined });
  if (byteLength(withoutTitle) <= CAPTURE_SOURCE_MAX_BYTES) return withoutTitle;

  return undefined;
}
