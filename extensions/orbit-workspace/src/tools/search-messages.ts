import { openOrbit, withErrors } from "../ai/context";
import { resolveConversation } from "../ai/resolve";
import { serializeMessage } from "../ai/serialize";
import { conversationTitle } from "../lib/chat-format";

type Input = {
  /** Words to find. Every word must match; the last one can be the start of a word. At most 500 characters. */
  query: string;
  /** Only this conversation: channel name, the name of the person in a direct message, or an ID. */
  conversation?: string;
  /** The nextCursor of the previous result, for older matches. */
  cursor?: string;
};

/** Searches chat messages, newest first, 20 per page. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("chat:read");
    const [conversations, members] = await Promise.all([orbit.client.conversations(), orbit.members()]);
    const names = new Map(members.map((m) => [m.user_id, m.display_name]));
    const conversation = input.conversation
      ? resolveConversation(conversations, input.conversation, names, orbit.userId)
      : undefined;
    const page = await orbit.client.searchMessages(input.query.slice(0, 500), conversation?.id, input.cursor);
    const byId = new Map(conversations.map((c) => [c.id, c]));
    return {
      messages: page.items.map(({ message, conversation_id }) => {
        const where = byId.get(conversation_id);
        return {
          conversation: where ? conversationTitle(where, names, orbit.userId) : null,
          ...serializeMessage(message, orbit.base, names, byId),
        };
      }),
      nextCursor: page.cursor,
    };
  });
}
