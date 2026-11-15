import type { Tool } from "@raycast/api";

import { openOrbit, withErrors, type OrbitContext } from "../ai/context";
import { resolveDoc } from "../ai/resolve";
import { serializeDoc } from "../ai/serialize";
import type { NewDoc } from "../api/types";
import { docTitle } from "../lib/docs";

type Input = {
  title: string;
  /** The content, in Markdown. */
  markdown?: string;
  /** "default" (the default teamspace, used when omitted), "private" (only the user can see it), or the ID or title of a parent doc to put it inside. */
  location?: string;
  /** One emoji. */
  icon?: string;
};

async function prepare(orbit: OrbitContext, input: Input) {
  if (!input.title?.trim()) throw new Error("The doc needs a title.");
  const location = (input.location ?? "default").trim();
  const body: NewDoc = { title: input.title.trim(), markdown: input.markdown, icon: input.icon?.trim() || undefined };
  let where = "Default teamspace";
  if (location.toLowerCase() === "private") {
    body.private = true;
    where = "Private";
  } else if (location.toLowerCase() !== "default") {
    const parent = resolveDoc(await orbit.client.listDocs(), location);
    body.parent_id = parent.id;
    where = `Inside "${docTitle(parent)}"`;
  }
  return { body, where };
}

export const confirmation: Tool.Confirmation<Input> = (input) =>
  withErrors(async () => {
    const { body, where } = await prepare(await openOrbit("docs:write"), input);
    return {
      message: "Create this doc in Orbit?",
      info: [
        { name: "Title", value: body.title },
        { name: "Location", value: where },
        { name: "Content", value: body.markdown ? `${body.markdown.length} characters of Markdown` : "Empty" },
      ],
    };
  });

/** Creates a doc from Markdown. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("docs:write");
    const { body } = await prepare(orbit, input);
    const doc = await orbit.client.createDoc(body);
    return serializeDoc(doc, orbit.base, orbit.workspaceId, "");
  });
}
