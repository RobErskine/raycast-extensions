import type { Comment, Conversation, DocSummary, Label, Message, Project, Status, Task } from "../api/types";
import { webUrls } from "../api/url";
import { authorName, conversationTitle, resolveMentions } from "../lib/chat-format";
import { docTitle } from "../lib/docs";
import { absoluteUrl } from "../lib/markdown";

export interface TaskNames {
  projects: Map<string, Project>;
  statuses: Map<string, Status>;
  members: Map<string, string>;
  labels?: Map<string, Label>;
}

/** A task as plain data for the AI. Names instead of IDs, and no description unless asked. */
export function serializeTask(task: Task, names: TaskNames, withDescription = false) {
  const status = names.statuses.get(task.status_id);
  return {
    identifier: task.identifier,
    title: task.title,
    url: task.url,
    project: names.projects.get(task.project_id)?.name ?? null,
    status: status?.name ?? null,
    statusCategory: status?.category ?? null,
    priority: task.priority,
    assignees: task.assignee_ids.map((id) => names.members.get(id) ?? id),
    labels: names.labels ? task.label_ids.map((id) => names.labels!.get(id)?.name ?? id) : undefined,
    dueAt: task.due_at,
    parentTaskId: task.parent_task_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    ...(withDescription ? { description: task.description } : {}),
  };
}

export function serializeComment(comment: Comment, members: Map<string, string>) {
  return {
    author: comment.author_service_account?.name ?? (comment.author_id ? members.get(comment.author_id) : null) ?? null,
    body: comment.body,
    createdAt: comment.created_at,
  };
}

export function serializeDoc(doc: DocSummary, base: string, workspaceId: string, path: string) {
  return {
    id: doc.id,
    title: docTitle(doc),
    url: webUrls.doc(base, workspaceId, doc.id),
    path: path || null,
    space: doc.private ? "private" : "shared",
    updatedAt: doc.updated_at,
  };
}

export function serializeConversation(conversation: Conversation, members: Map<string, string>, userId?: string) {
  return {
    id: conversation.id,
    name: conversationTitle(conversation, members, userId),
    kind: conversation.kind === "dm" ? "direct message" : `${conversation.kind} channel`,
    topic: conversation.topic || null,
    archived: conversation.archived,
    lastMessageAt: conversation.last_message_at,
  };
}

export function serializeMessage(
  message: Message,
  base: string,
  members: Map<string, string>,
  conversations: Map<string, Conversation>,
) {
  const threadRoot = message.thread_root_id ?? (message.reply_count > 0 ? message.id : null);
  return {
    id: message.id,
    author: authorName(message, members),
    text: message.deleted ? "(deleted)" : resolveMentions(message.body, { members, conversations }),
    kind: message.kind,
    sentAt: message.created_at,
    replies: message.reply_count,
    files: message.attachments.map((file) => ({ name: file.file_name, url: absoluteUrl(base, file.url) })),
    url: threadRoot
      ? webUrls.thread(base, message.conversation_id, threadRoot)
      : webUrls.conversation(base, message.conversation_id),
  };
}
