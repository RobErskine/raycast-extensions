import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { useCachedState } from "@raycast/utils";

import { webUrls } from "./api/url";
import { Guard } from "./components/Guard";
import { MessageList } from "./components/MessageList";
import { SearchMessages } from "./components/SearchMessages";
import { useChat, type ConversationEntry } from "./hooks/useChat";
import type { Orbit } from "./hooks/useOrbit";

export default function Command() {
  return <Guard scope="chat:read">{(orbit) => <BrowseChat orbit={orbit} />}</Guard>;
}

function BrowseChat({ orbit }: { orbit: Orbit }) {
  const { channels, directMessages, archived, isLoading, revalidate } = useChat(orbit);
  const [showArchived, setShowArchived] = useCachedState("chat.show-archived", false);

  const item = ({ conversation, title }: ConversationEntry) => {
    const url = webUrls.conversation(orbit.client.base, conversation.id);
    const icon = conversation.kind === "dm" ? Icon.Person : conversation.kind === "private" ? Icon.Lock : Icon.Hashtag;
    return (
      <List.Item
        key={conversation.id}
        icon={icon}
        title={title}
        subtitle={conversation.topic || undefined}
        keywords={[conversation.name, conversation.topic].filter(Boolean)}
        accessories={
          conversation.last_message_at
            ? [{ date: new Date(conversation.last_message_at), tooltip: "Last message" }]
            : undefined
        }
        actions={
          <ActionPanel title={title}>
            <ActionPanel.Section>
              <Action.Push
                title="Show Messages"
                icon={Icon.Bubble}
                target={<MessageList orbit={orbit} conversationId={conversation.id} />}
              />
              <Action.OpenInBrowser title="Open in Orbit" url={url} />
              <Action.Push
                title="Search in Conversation"
                icon={Icon.MagnifyingGlass}
                shortcut={{ modifiers: ["cmd"], key: "f" }}
                target={<SearchMessages orbit={orbit} conversationId={conversation.id} />}
              />
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.CopyToClipboard title="Copy Link" content={url} shortcut={Keyboard.Shortcut.Common.Copy} />
              <Action
                title={showArchived ? "Hide Archived" : "Show Archived"}
                icon={Icon.Tray}
                shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
                onAction={() => setShowArchived(!showArchived)}
              />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={() => revalidate()}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter conversations">
      <List.EmptyView icon={Icon.Bubble} title="No conversations" />
      <List.Section title="Channels">{channels.map(item)}</List.Section>
      <List.Section title="Direct Messages">{directMessages.map(item)}</List.Section>
      {showArchived && <List.Section title="Archived">{archived.map(item)}</List.Section>}
    </List>
  );
}
