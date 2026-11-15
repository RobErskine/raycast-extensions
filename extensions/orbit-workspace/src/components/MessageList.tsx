import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";

import { fromMessagePage } from "../api/pagination";
import { webUrls } from "../api/url";
import { useChat } from "../hooks/useChat";
import type { Orbit } from "../hooks/useOrbit";
import { showError } from "../lib/errors";

import { MessageItem } from "./MessageItem";

interface MessageListProps {
  orbit: Orbit;
  conversationId: string;
  /** Shows this thread (root and replies) instead of the conversation. */
  threadRootId?: string;
}

/** The messages of a conversation or a thread, newest first. */
export function MessageList({ orbit, conversationId, threadRootId }: MessageListProps) {
  const { lookups, titles } = useChat(orbit);
  const [showDetail, setShowDetail] = useCachedState("chat.detail", true);

  const { data, isLoading, pagination, revalidate } = useCachedPromise(
    (_query: "messages", _scope: string, conversation: string, root: string) =>
      async ({ cursor }: { cursor?: string }) => {
        if (!root) return fromMessagePage(await orbit.client.messages(conversation, cursor));
        const thread = await orbit.client.thread(root, cursor);
        const page = fromMessagePage(thread);
        // The root comes last: it is the oldest message of the thread.
        return page.hasMore ? page : { ...page, data: [...page.data, thread.root] };
      },
    ["messages", orbit.cacheScope, conversationId, threadRootId ?? ""],
    { keepPreviousData: true, onError: (error) => showError(error, "Could not load messages") },
  );

  const title = titles.get(conversationId) ?? "Conversation";
  const url = threadRootId
    ? webUrls.thread(orbit.client.base, conversationId, threadRootId)
    : webUrls.conversation(orbit.client.base, conversationId);

  const listActions = (
    <ActionPanel.Section title="View">
      <Action
        title={showDetail ? "Hide Details" : "Show Details"}
        icon={Icon.Sidebar}
        shortcut={{ modifiers: ["cmd"], key: "d" }}
        onAction={() => setShowDetail(!showDetail)}
      />
      <Action.OpenInBrowser
        title={threadRootId ? "Open Thread in Orbit" : "Open Conversation in Orbit"}
        url={url}
        shortcut={Keyboard.Shortcut.Common.Open}
      />
      <Action
        title="Refresh"
        icon={Icon.ArrowClockwise}
        shortcut={Keyboard.Shortcut.Common.Refresh}
        onAction={() => revalidate()}
      />
    </ActionPanel.Section>
  );

  const messages = data ?? [];
  return (
    <List
      navigationTitle={threadRootId ? `Thread in ${title}` : title}
      isLoading={isLoading}
      isShowingDetail={showDetail && messages.length > 0}
      pagination={pagination}
      searchBarPlaceholder="Filter loaded messages"
    >
      <List.EmptyView icon={Icon.Bubble} title="No messages" actions={<ActionPanel>{listActions}</ActionPanel>} />
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          orbit={orbit}
          message={message}
          lookups={lookups}
          showDetail={showDetail}
          inThread={Boolean(threadRootId)}
          listActions={listActions}
        />
      ))}
    </List>
  );
}
