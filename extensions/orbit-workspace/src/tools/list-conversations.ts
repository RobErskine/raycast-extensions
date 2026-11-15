import { openOrbit, withErrors } from "../ai/context";
import { serializeConversation } from "../ai/serialize";

type Input = {
  /** Also list archived conversations. Default: false. */
  includeArchived?: boolean;
};

/** The chat channels and direct messages the user can read, most recently active first. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("chat:read");
    const [conversations, members] = await Promise.all([orbit.client.conversations(), orbit.members()]);
    const names = new Map(members.map((m) => [m.user_id, m.display_name]));
    return conversations
      .filter((c) => input.includeArchived || !c.archived)
      .sort((a, b) => Date.parse(b.last_message_at ?? "1970-01-01") - Date.parse(a.last_message_at ?? "1970-01-01"))
      .map((c) => serializeConversation(c, names, orbit.userId));
  });
}
