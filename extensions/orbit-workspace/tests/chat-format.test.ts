import { describe, expect, it } from "vitest";

import type { Conversation, Message } from "../src/api/types";
import { authorName, conversationTitle, firstLine, messageTitle, resolveMentions } from "../src/lib/chat-format";

const ME = "00000000-0000-7000-8000-000000000001";
const ANA = "00000000-0000-7000-8000-000000000002";
const BEN = "00000000-0000-7000-8000-000000000003";
const GENERAL = "00000000-0000-7000-8000-0000000000aa";
const members = new Map([
  [ME, "Rob"],
  [ANA, "Ana"],
  [BEN, "Ben"],
]);

const conversation = (overrides: Partial<Conversation>): Conversation => ({
  id: GENERAL,
  kind: "public",
  name: "general",
  topic: "",
  position: 0,
  member_ids: [ME, ANA],
  is_default: true,
  self_dm: false,
  archived: false,
  last_message_at: null,
  ...overrides,
});

describe("resolveMentions", () => {
  it("replaces member, channel and group mentions", () => {
    const conversations = new Map([[GENERAL, conversation({})]]);
    expect(resolveMentions(`Hi <@${ANA}>, see <#${GENERAL}> <!here> <!channel>`, { members, conversations })).toBe(
      "Hi @Ana, see #general @here @channel",
    );
  });

  it("names unknown members and channels generically", () => {
    expect(resolveMentions(`<@${"f".repeat(8)}-0000-7000-8000-000000000000> <#${GENERAL}>`, { members })).toBe(
      "@someone #channel",
    );
  });
});

describe("firstLine", () => {
  it("skips empty lines and block syntax, and shortens", () => {
    expect(firstLine("\n\n## Release\nmore")).toBe("Release");
    expect(firstLine("- item")).toBe("item");
    expect(firstLine("x".repeat(10), 5)).toBe("xxxx…");
  });
});

describe("messageTitle", () => {
  const base = {
    id: "m",
    conversation_id: GENERAL,
    thread_root_id: null,
    kind: "message",
    author_id: ANA,
    body: "",
    created_at: "2026-11-10T10:00:00.000Z",
    edited_at: null,
    deleted: false,
    attachments: [],
    reactions: [],
    reply_count: 0,
    bot: null,
  } satisfies Message;

  it("uses the first line, a file name, or the event", () => {
    expect(messageTitle({ ...base, body: `ping <@${ME}>\nsecond` }, { members })).toBe("ping @Rob");
    expect(
      messageTitle({ ...base, attachments: [{ id: "f", url: "/f", file_name: "a.pdf", mime_type: "" }] }, { members }),
    ).toBe("📎 a.pdf");
    expect(messageTitle({ ...base, kind: "join" }, { members })).toBe("Ana joined the conversation");
    expect(messageTitle({ ...base, body: "secret", deleted: true }, { members })).toBe("Deleted message");
  });

  it("shows an integration as the author, not the member who set it up", () => {
    const bot = { name: "GitHub", icon_emoji: null };
    expect(authorName({ ...base, bot }, members)).toBe("GitHub");
    expect(authorName(base, members)).toBe("Ana");
    expect(authorName({ ...base, author_id: "unknown" }, members)).toBe("Member");
    expect(messageTitle({ ...base, kind: "join", bot }, { members })).toBe("GitHub joined the conversation");
  });
});

describe("conversationTitle", () => {
  it("names channels and direct messages", () => {
    expect(conversationTitle(conversation({}), members, ME)).toBe("#general");
    expect(conversationTitle(conversation({ kind: "dm", name: "", member_ids: [ME, ANA, BEN] }), members, ME)).toBe(
      "Ana, Ben",
    );
    expect(conversationTitle(conversation({ kind: "dm", name: "", member_ids: [ME], self_dm: true }), members, ME)).toBe(
      "You (notes)",
    );
    expect(conversationTitle(conversation({ kind: "dm", name: "", member_ids: [ME, ANA] }), new Map(), ME)).toBe(
      "Direct message (1)",
    );
  });
});
