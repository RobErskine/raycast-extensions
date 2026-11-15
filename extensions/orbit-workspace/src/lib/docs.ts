import type { DocSummary } from "../api/types";

export function docTitle(doc: Pick<DocSummary, "title">): string {
  return doc.title.trim() || "Untitled";
}

/** The titles of a doc's parents, nearest last: "Handbook › Engineering". */
export function breadcrumb(doc: DocSummary, byId: Map<string, DocSummary>): string {
  const parts: string[] = [];
  const seen = new Set<string>([doc.id]);
  let parentId = doc.parent_id;
  while (parentId && !seen.has(parentId) && parts.length < 10) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(docTitle(parent));
    parentId = parent.parent_id;
  }
  return parts.join(" › ");
}

/** Orbit writes links to other docs as `/docs/{id}`; make them open the web app. */
export function absoluteDocLinks(markdown: string, base: string, workspaceId: string): string {
  return markdown.replace(
    /\]\(\/docs\/([0-9a-f-]{36})\)/gi,
    (_, id: string) => `](${base}/docs/${id}?workspace=${encodeURIComponent(workspaceId)})`,
  );
}

/** The doc's Markdown with `text` added as new blocks at the end. */
export function appendMarkdown(markdown: string, text: string): string {
  const head = markdown.trimEnd();
  const tail = text.trim();
  return head ? `${head}\n\n${tail}\n` : `${tail}\n`;
}
