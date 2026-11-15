import { openOrbit, withErrors } from "../ai/context";
import type { Message } from "../api/types";
import { resolveConversation } from "../ai/resolve";
import { serializeMessage } from "../ai/serialize";
import { conversationTitle } from "../lib/chat-format";

type Input = {
  /** Channel name (for example general or #general), the name of the person in a direct message, or a conversation ID. */
  conversation: string;
  /** A message ID: return that message's thread (the message and its replies) instead of the conversation. */
  threadOf?: string;
  /** Maximum number of messages, from 1 to 100. Default: 30. */
  limit?: number;
  /** The olderCursor of the previous result, for older messages. */
  olderCursor?: string;
};

/** Reads chat messages, newest last. Orbit chat is read-only here: messages cannot be sent. */
export default async function (input: Input) {
  return withErrors(async () => {
    const orbit = await openOrbit("chat:read");
    const [conversations, members] = await Promise.all([orbit.client.conversations(), orbit.members()]);
    const names = new Map(members.map((m) => [m.user_id, m.display_name]));
    const conversation = resolveConversation(conversations, input.conversation, names, orbit.userId);
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    let items: Message[];
    let before: string | null;
    if (input.threadOf) {
      const thread = await orbit.client.thread(input.threadOf, input.olderCursor, limit);
      // The root is the oldest message of the thread: it comes with the last (oldest) page.
      items = thread.before ? thread.items : [thread.root, ...thread.items];
      before = thread.before;
    } else {
      const page = await orbit.client.messages(conversation.id, input.olderCursor, limit);
      items = page.items;
      before = page.before;
    }
    const byId = new Map(conversations.map((c) => [c.id, c]));
    return {
      conversation: conversationTitle(conversation, names, orbit.userId),
      messages: items.map((m) => serializeMessage(m, orbit.base, names, byId)),
      olderCursor: before,
    };
  });
}
