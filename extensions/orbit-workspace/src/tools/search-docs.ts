import { openOrbit, withErrors } from "../ai/context";
import { serializeDoc } from "../ai/serialize";
import { breadcrumb, docTitle } from "../lib/docs";

type Input = {
  /** Words in the doc title or in the titles of its parent docs. Orbit cannot search doc content. Omit to list the newest docs. */
  query?: string;
  /** Maximum number of docs, from 1 to 100. Default: 25. */
  limit?: number;
};

/** Finds docs by title. Use get-doc to read one. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("docs:read");
    const docs = await orbit.client.listDocs();
    const byId = new Map(docs.map((d) => [d.id, d]));
    const words = (input.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const matches = docs
      .map((doc) => ({ doc, path: breadcrumb(doc, byId) }))
      .filter(({ doc, path }) => {
        const text = `${docTitle(doc)} ${path}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => Date.parse(b.doc.updated_at) - Date.parse(a.doc.updated_at));
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    return {
      docs: matches.slice(0, limit).map(({ doc, path }) => serializeDoc(doc, orbit.base, orbit.workspaceId, path)),
      total: matches.length,
    };
  });
}
