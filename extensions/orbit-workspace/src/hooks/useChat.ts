import { useMemo } from "react";

import type { Conversation } from "../api/types";
import { conversationTitle, type NameLookups } from "../lib/chat-format";
import { showError } from "../lib/errors";

import type { Orbit } from "./useOrbit";
import { useQuery } from "./useQuery";
import { useMembers } from "./useWorkspaceData";

export interface ConversationEntry {
  conversation: Conversation;
  title: string;
}

function byActivity(a: Conversation, b: Conversation): number {
  return Date.parse(b.last_message_at ?? "1970-01-01") - Date.parse(a.last_message_at ?? "1970-01-01");
}

/** Visible conversations with their titles, and the name lookups that messages need. */
export function useChat(orbit: Orbit) {
  const { names, isLoading: membersLoading } = useMembers(orbit);
  const { data, isLoading, revalidate } = useQuery(
    ["conversations", orbit.cacheScope],
    () => orbit.client.conversations(),
    { keepPreviousData: true, onError: (error) => showError(error, "Could not load conversations") },
  );

  return useMemo(() => {
    const conversations = data ?? [];
    const entry = (conversation: Conversation): ConversationEntry => ({
      conversation,
      title: conversationTitle(conversation, names, orbit.userId),
    });
    const live = conversations.filter((c) => !c.archived);
    const channels = live
      .filter((c) => c.kind !== "dm")
      .sort(
        (a, b) =>
          Number(b.is_default) - Number(a.is_default) || a.position - b.position || a.name.localeCompare(b.name),
      )
      .map(entry);
    const directMessages = live
      .filter((c) => c.kind === "dm")
      .sort(byActivity)
      .map(entry);
    const archived = conversations
      .filter((c) => c.archived)
      .sort(byActivity)
      .map(entry);
    const lookups: NameLookups = { members: names, conversations: new Map(conversations.map((c) => [c.id, c])) };
    const titles = new Map([...channels, ...directMessages, ...archived].map((e) => [e.conversation.id, e.title]));
    return { channels, directMessages, archived, lookups, titles, isLoading: isLoading || membersLoading, revalidate };
  }, [data, names, isLoading, membersLoading, orbit.userId]);
}
