// Shapes of the Orbit public REST API (`/api/public/v1`) and of the chat tools of `/mcp`.
// Field names are the API's own.

export type Scope = "tasks:read" | "tasks:write" | "docs:read" | "docs:write" | "chat:read";

export interface Me {
  token: { id: string; name: string; scopes: Scope[]; project_ids: string[]; expires_at: string | null };
  workspace: { id: string; name: string };
  workspaces: { id: string; name: string; scopes: Scope[]; project_ids: string[] }[];
  user: { id: string; email: string; display_name: string } | null;
  service_account: { id: string; name: string } | null;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  color: string;
}

export type StatusCategory = "unstarted" | "started" | "completed" | "cancelled" | "duplicate";

export interface Status {
  id: string;
  project_id: string;
  name: string;
  description: string;
  color: string;
  category: StatusCategory;
  position: number;
}

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface Member {
  user_id: string;
  display_name: string;
}

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  project_id: string;
  number: number;
  identifier: string;
  url: string;
  status_id: string;
  title: string;
  description: string;
  priority: Priority;
  assignee_ids: string[];
  label_ids: string[];
  due_start_at: string | null;
  due_at: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface TaskQuery {
  project_id?: string;
  status_id?: string;
  assignee_id?: string;
  priority?: Priority;
  label_id?: string;
  q?: string;
  sort?: "created_at" | "updated_at" | "priority" | "due_date" | "title";
  order?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

export interface NewTask {
  project_id: string;
  status_id: string;
  title: string;
  description?: string;
  priority?: Priority;
  assignee_ids?: string[];
  label_ids?: string[];
  due_at?: string | null;
}

export interface TaskPatch {
  expected_version: number;
  title?: string;
  description?: string;
  status_id?: string;
  priority?: Priority;
  assignee_ids?: string[];
  label_ids?: string[];
  due_at?: string | null;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  author_service_account: { id: string; name: string } | null;
  body: string;
  created_at: string;
}

export interface DocSummary {
  id: string;
  parent_id: string | null;
  teamspace_id: string | null;
  private: boolean;
  title: string;
  icon: string | null;
  position: number;
  version: number;
  updated_at: string;
}

export interface Doc extends DocSummary {
  markdown: string;
}

export interface NewDoc {
  title?: string;
  markdown?: string;
  icon?: string;
  parent_id?: string;
  private?: boolean;
}

export interface DocPatch {
  expected_version: number;
  title?: string;
  markdown?: string;
}

// Chat (MCP tools, scope chat:read)

export interface Conversation {
  id: string;
  kind: "public" | "private" | "dm";
  /** Empty for a direct message. */
  name: string;
  topic: string;
  position: number;
  member_ids: string[];
  is_default: boolean;
  self_dm: boolean;
  archived: boolean;
  last_message_at: string | null;
}

export interface ChatFile {
  id: string;
  url: string;
  file_name: string;
  mime_type: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  thread_root_id: string | null;
  kind: "message" | "pin" | "join" | "leave";
  author_id: string;
  /** Markdown with mention tokens: `<@user_id>`, `<#conversation_id>`, `<!channel>`, `<!here>`. */
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
  attachments: ChatFile[];
  reactions: { emoji: string; user_ids: string[] }[];
  reply_count: number;
  /** Set when an integration posted the message: `author_id` is then the member who set it up. */
  bot: { name: string; icon_emoji: string | null } | null;
}

/** Messages in ascending order. `before` is the cursor for older messages, null when there are none. */
export interface MessagePage {
  items: Message[];
  before: string | null;
  after: string | null;
}

export interface ThreadPage extends MessagePage {
  root: Message;
}

export interface SearchPage {
  items: { message: Message; conversation_id: string }[];
  cursor: string | null;
}
