import type { Conversation, Message } from "../api/types";

export interface NameLookups {
  members: Map<string, string>;
  conversations?: Map<string, Conversation>;
}

/** Replaces Orbit's mention tokens with readable text. */
export function resolveMentions(body: string, { members, conversations }: NameLookups): string {
  return body
    .replace(/<@([0-9a-f-]{36})>/gi, (_, id: string) => `@${members.get(id) ?? "someone"}`)
    .replace(/<#([0-9a-f-]{36})>/gi, (_, id: string) => {
      const conversation = conversations?.get(id);
      return conversation?.name ? `#${conversation.name}` : "#channel";
    })
    .replace(/<!channel>/g, "@channel")
    .replace(/<!here>/g, "@here");
}

/** The first non-empty line of Markdown, without leading block syntax. */
export function firstLine(markdown: string, max = 120): string {
  const line =
    markdown
      .split("\n")
      .map((l) => l.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, "").trim())
      .find((l) => l.length > 0) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

const SYSTEM_TEXT: Record<Exclude<Message["kind"], "message">, string> = {
  join: "joined the conversation",
  leave: "left the conversation",
  pin: "pinned a message",
};

/** Who to show as the author: the integration that posted it, else the member. */
export function authorName(message: Message, members: Map<string, string>, fallback = "Member"): string {
  return message.bot?.name || members.get(message.author_id) || fallback;
}

/** The one-line title of a message in a list. */
export function messageTitle(message: Message, lookups: NameLookups): string {
  if (message.kind !== "message")
    return `${authorName(message, lookups.members, "Someone")} ${SYSTEM_TEXT[message.kind]}`;
  if (message.deleted) return "Deleted message";
  const text = firstLine(resolveMentions(message.body, lookups));
  if (text) return text;
  const file = message.attachments[0];
  return file ? `📎 ${file.file_name}` : "(empty message)";
}

/** A conversation's name: `#name` for a channel, the other members' names for a direct message. */
export function conversationTitle(conversation: Conversation, members: Map<string, string>, userId?: string): string {
  if (conversation.kind !== "dm") return `#${conversation.name}`;
  if (conversation.self_dm) return "You (notes)";
  const others = conversation.member_ids.filter((id) => id !== userId);
  const names = others.map((id) => members.get(id)).filter((name): name is string => Boolean(name));
  if (names.length === others.length && names.length > 0) return names.join(", ");
  return `Direct message (${others.length || conversation.member_ids.length})`;
}
