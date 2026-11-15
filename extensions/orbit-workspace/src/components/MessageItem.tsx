import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import type { ReactNode } from "react";

import type { Message } from "../api/types";
import { webUrls } from "../api/url";
import type { Orbit } from "../hooks/useOrbit";
import { authorName, messageTitle, resolveMentions, type NameLookups } from "../lib/chat-format";
import { absoluteUrl, escapeMarkdown } from "../lib/markdown";
import { formatDate } from "../lib/presentation";

import { MessageList } from "./MessageList";

interface MessageItemProps {
  orbit: Orbit;
  message: Message;
  lookups: NameLookups;
  /** The conversation's title, shown in search results. */
  conversationTitle?: string;
  showDetail: boolean;
  /** Hides "Open Thread" inside the thread itself. */
  inThread?: boolean;
  /** List-level actions (toggles, refresh). */
  listActions?: ReactNode;
}

function messageMarkdown(orbit: Orbit, message: Message, lookups: NameLookups): string {
  if (message.deleted) return "_This message was deleted._";
  const parts = [resolveMentions(message.body, lookups) || ""];
  if (message.attachments.length > 0) {
    parts.push(
      message.attachments
        .map((file) => `📎 [${escapeMarkdown(file.file_name)}](${absoluteUrl(orbit.client.base, file.url)})`)
        .join("\n\n"),
    );
  }
  if (message.reactions.length > 0) {
    parts.push(message.reactions.map((r) => `${r.emoji} ${r.user_ids.length}`).join("  ·  "));
  }
  return parts.filter(Boolean).join("\n\n---\n\n");
}

export function MessageItem({
  orbit,
  message,
  lookups,
  conversationTitle,
  showDetail,
  inThread,
  listActions,
}: MessageItemProps) {
  const author = authorName(message, lookups.members);
  const threadRootId = message.thread_root_id ?? (message.reply_count > 0 ? message.id : null);
  const url = threadRootId
    ? webUrls.thread(orbit.client.base, message.conversation_id, threadRootId)
    : webUrls.conversation(orbit.client.base, message.conversation_id);
  const text = message.deleted ? "" : resolveMentions(message.body, lookups);
  const subtitle = conversationTitle ? `${conversationTitle} · ${author}` : author;

  return (
    <List.Item
      id={message.id}
      icon={message.kind === "message" ? Icon.Person : Icon.Info}
      title={messageTitle(message, lookups)}
      subtitle={showDetail ? undefined : subtitle}
      accessories={
        showDetail
          ? undefined
          : [
              ...(message.reply_count > 0 && !inThread
                ? [{ icon: Icon.Bubble, text: String(message.reply_count), tooltip: "Replies" }]
                : []),
              ...(message.attachments.length > 0 ? [{ icon: Icon.Paperclip }] : []),
              { date: new Date(message.created_at), tooltip: new Date(message.created_at).toLocaleString() },
            ]
      }
      detail={
        <List.Item.Detail
          markdown={messageMarkdown(orbit, message, lookups)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="From"
                text={author}
                icon={message.bot ? Icon.Plug : Icon.Person}
              />
              {conversationTitle && <List.Item.Detail.Metadata.Label title="In" text={conversationTitle} />}
              <List.Item.Detail.Metadata.Label title="Sent" text={new Date(message.created_at).toLocaleString()} />
              {message.edited_at && (
                <List.Item.Detail.Metadata.Label title="Edited" text={formatDate(message.edited_at)} />
              )}
              {message.reply_count > 0 && (
                <List.Item.Detail.Metadata.Label title="Replies" text={String(message.reply_count)} />
              )}
              <List.Item.Detail.Metadata.Link title="Orbit" text="Open in Orbit" target={url} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {threadRootId && !inThread && (
              <Action.Push
                title="Open Thread"
                icon={Icon.Bubble}
                target={
                  <MessageList orbit={orbit} threadRootId={threadRootId} conversationId={message.conversation_id} />
                }
              />
            )}
            <Action.OpenInBrowser title="Open in Orbit" url={url} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            {text && (
              <Action.CopyToClipboard title="Copy Text" content={text} shortcut={Keyboard.Shortcut.Common.CopyName} />
            )}
            <Action.CopyToClipboard title="Copy Link" content={url} shortcut={Keyboard.Shortcut.Common.Copy} />
          </ActionPanel.Section>
          {listActions}
        </ActionPanel>
      }
    />
  );
}
