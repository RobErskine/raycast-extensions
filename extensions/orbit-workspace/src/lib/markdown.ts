/** Escapes text so that Markdown shows it as written, for example a task title in a heading. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, (char) => `\\${char}`);
}

/**
 * Orbit returns same-origin paths such as `/api/v1/…`. Joins them to the base URL, which can have
 * a path prefix (Orbit behind a proxy at `/orbit`).
 */
export function absoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}
