import { openOrbit, withErrors } from "../ai/context";
import { resolveDoc } from "../ai/resolve";
import { serializeDoc } from "../ai/serialize";
import { absoluteDocLinks, breadcrumb } from "../lib/docs";

type Input = {
  /** Doc ID (from search-docs) or exact title. */
  doc: string;
};

/** Reads a doc. Its content is Markdown. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("docs:read");
    const docs = await orbit.client.listDocs();
    const summary = resolveDoc(docs, input.doc);
    const doc = await orbit.client.getDoc(summary.id);
    const path = breadcrumb(summary, new Map(docs.map((d) => [d.id, d])));
    return {
      ...serializeDoc(summary, orbit.base, orbit.workspaceId, path),
      markdown: absoluteDocLinks(doc.markdown, orbit.base, orbit.workspaceId),
    };
  });
}
