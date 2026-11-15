import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { useState } from "react";

import { fromSearchPage } from "../api/pagination";
import { useChat } from "../hooks/useChat";
import type { Orbit } from "../hooks/useOrbit";
import { showError } from "../lib/errors";

import { MessageItem } from "./MessageItem";

/** Orbit search takes at most 500 characters. */
const MAX_QUERY = 500;

export function SearchMessages({ orbit, conversationId }: { orbit: Orbit; conversationId?: string }) {
  const chat = useChat(orbit);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState(conversationId ?? "");
  const [showDetail, setShowDetail] = useCachedState("chat.detail", true);
  const query = searchText.trim().slice(0, MAX_QUERY);

  const { data, isLoading, pagination } = useCachedPromise(
    (_query: "message-search", _scope: string, q: string, conversation: string) =>
      async ({ cursor }: { cursor?: string }) =>
        fromSearchPage(await orbit.client.searchMessages(q, conversation || undefined, cursor)),
    ["message-search", orbit.cacheScope, query, filter],
    { execute: query.length > 0, keepPreviousData: true, onError: (error) => showError(error, "Could not search") },
  );

  const hits = query ? (data ?? []) : [];
  const listActions = (
    <ActionPanel.Section title="View">
      <Action
        title={showDetail ? "Hide Details" : "Show Details"}
        icon={Icon.Sidebar}
        shortcut={{ modifiers: ["cmd"], key: "d" }}
        onAction={() => setShowDetail(!showDetail)}
      />
    </ActionPanel.Section>
  );

  return (
    <List
      isLoading={(query.length > 0 && isLoading) || chat.isLoading}
      isShowingDetail={showDetail && hits.length > 0}
      onSearchTextChange={setSearchText}
      throttle
      pagination={query ? pagination : undefined}
      searchBarPlaceholder="Search messages"
      searchBarAccessory={
        <List.Dropdown tooltip="Conversation" value={filter} onChange={setFilter}>
          <List.Dropdown.Item title="All Conversations" value="" icon={Icon.Bubble} />
          <List.Dropdown.Section title="Channels">
            {chat.channels.map(({ conversation, title }) => (
              <List.Dropdown.Item key={conversation.id} title={title} value={conversation.id} />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Direct Messages">
            {chat.directMessages.map(({ conversation, title }) => (
              <List.Dropdown.Item key={conversation.id} title={title} value={conversation.id} />
            ))}
          </List.Dropdown.Section>
          {chat.archived.length > 0 && (
            <List.Dropdown.Section title="Archived">
              {chat.archived.map(({ conversation, title }) => (
                <List.Dropdown.Item key={conversation.id} title={title} value={conversation.id} />
              ))}
            </List.Dropdown.Section>
          )}
        </List.Dropdown>
      }
    >
      <List.EmptyView
        icon={Icon.MagnifyingGlass}
        title={query ? "No messages found" : "Type to search messages"}
        description={query ? "Every word must match; the last one can be the start of a word." : undefined}
      />
      {hits.map(({ message, conversation_id }) => (
        <MessageItem
          key={message.id}
          orbit={orbit}
          message={message}
          lookups={chat.lookups}
          conversationTitle={chat.titles.get(conversation_id)}
          showDetail={showDetail}
          listActions={listActions}
        />
      ))}
    </List>
  );
}
