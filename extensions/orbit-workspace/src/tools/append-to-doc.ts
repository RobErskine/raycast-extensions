import type { Tool } from "@raycast/api";

import { openOrbit, withErrors } from "../ai/context";
import { resolveDoc } from "../ai/resolve";
import { serializeDoc } from "../ai/serialize";
import { appendMarkdown, docTitle } from "../lib/docs";
import { withVersionRetry } from "../lib/retry";

type Input = {
  /** Doc ID (from search-docs) or exact title. */
  doc: string;
  /** Markdown to add at the end of the doc. The rest of the doc does not change. */
  markdown: string;
};

export const confirmation: Tool.Confirmation<Input> = (input) =>
  withErrors(async () => {
    const orbit = await openOrbit("docs:write");
    const doc = resolveDoc(await orbit.client.listDocs(), input.doc);
    return {
      message: "Add this text to the end of the doc?",
      info: [
        { name: "Doc", value: docTitle(doc) },
        { name: "Text", value: input.markdown },
      ],
    };
  });

/** Adds Markdown to the end of a doc. */
export default async function (input: Input) {
  return withErrors(async () => {
    if (!input.markdown?.trim()) throw new Error("The text to add is empty.");
    const orbit = await openOrbit("docs:write");
    const summary = resolveDoc(await orbit.client.listDocs(), input.doc);
    const read = () => orbit.client.getDoc(summary.id);
    const saved = await withVersionRetry(await read(), read, (current) =>
      orbit.client.updateDoc(summary.id, {
        expected_version: current.version,
        markdown: appendMarkdown(current.markdown, input.markdown),
      }),
    );
    return { ...serializeDoc(saved, orbit.base, orbit.workspaceId, ""), appended: true };
  });
}
