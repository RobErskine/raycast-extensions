import { describe, expect, it } from "vitest";

import {
  matchingStatusIds,
  parseDueDate,
  resolveAssignee,
  resolveConversation,
  resolveDoc,
  ResolveError,
  resolveMember,
  resolveProject,
  resolveStatus,
} from "../src/ai/resolve";
import type { Conversation, DocSummary, Member, Project, Status } from "../src/api/types";

const projects = [
  { id: "p1", key: "DBM", name: "Degenerate Baseball Manager", color: "" },
  { id: "p2", key: "SWY", name: "Swy", color: "" },
  { id: "p3", key: "BUMPN", name: "Bump Name Match", color: "" },
  { id: "p4", key: "BRIAN", name: "Brian Coulter Films", color: "" },
] as Project[];

const status = (id: string, name: string, category: Status["category"], position: number, project_id = "p1") =>
  ({ id, name, category, position, project_id }) as Status;
const statuses = [
  status("s3", "Done", "completed", 3),
  status("s0", "Backlog", "unstarted", 0),
  status("s1", "Todo", "unstarted", 1),
  status("s2", "In Progress", "started", 2),
  status("s4", "Canceled", "cancelled", 4),
];

const members: Member[] = [
  { user_id: "u1", display_name: "Rob Erskine" },
  { user_id: "u2", display_name: "Ana Lopez" },
  { user_id: "u3", display_name: "Ana Smith" },
];

describe("resolveProject", () => {
  it("matches a key or name in any letter case, or one partial name", () => {
    expect(resolveProject(projects, "dbm").id).toBe("p1");
    expect(resolveProject(projects, "degenerate baseball manager").id).toBe("p1");
    expect(resolveProject(projects, "Baseball").id).toBe("p1");
    expect(resolveProject(projects, "p2").id).toBe("p2");
  });

  it("refuses an ambiguous or unknown name and lists the options", () => {
    expect(() => resolveProject(projects, "B")).toThrow(/more than one project/);
    expect(() => resolveProject(projects, "XYZ")).toThrow(ResolveError);
    expect(() => resolveProject(projects, "XYZ")).toThrow(/Degenerate Baseball Manager \(DBM\)/);
  });
});

describe("resolveStatus", () => {
  it("matches a status name first, then a category word", () => {
    expect(resolveStatus(statuses, "in progress").id).toBe("s2");
    expect(resolveStatus(statuses, "done").id).toBe("s3");
    expect(resolveStatus(statuses, "open").id).toBe("s0");
    expect(resolveStatus(statuses, "todo").id).toBe("s1");
    expect(resolveStatus(statuses, "cancelled").id).toBe("s4");
    expect(resolveStatus(statuses, "closed").id).toBe("s3");
  });

  it("refuses an unknown status", () => {
    expect(() => resolveStatus(statuses, "Review")).toThrow(/No status of this project matches/);
  });

  it("matches a name or category in every project", () => {
    const all = [
      ...statuses,
      status("x2", "In progress", "started", 1, "p2"),
      status("x3", "Shipped", "completed", 2, "p2"),
    ];
    expect([...matchingStatusIds(all, "In Progress")].sort()).toEqual(["s2", "x2"]);
    expect([...matchingStatusIds(all, "done")].sort()).toEqual(["s3", "x3"]);
    expect(() => matchingStatusIds(all, "Review")).toThrow(/No status matches/);
  });
});

describe("assignees", () => {
  it("maps me, nobody and names", () => {
    expect(resolveAssignee(members, "me", "u1")).toBe("u1");
    expect(resolveAssignee(members, "unassigned", "u1")).toBe("none");
    expect(resolveMember(members, "rob", "u1")).toBe("u1");
    expect(resolveMember(members, "Ana Smith", "u1")).toBe("u3");
  });

  it("refuses an ambiguous first name, and 'me' without a person", () => {
    expect(() => resolveMember(members, "Ana", "u1")).toThrow(/more than one member/);
    expect(() => resolveAssignee(members, "me", undefined)).toThrow(/service account/);
  });
});

describe("resolveDoc and resolveConversation", () => {
  it("finds docs by ID or title", () => {
    const docs = [
      { id: "d1", title: "Draft order rules" },
      { id: "d2", title: "" },
    ] as DocSummary[];
    expect(resolveDoc(docs, "draft order").id).toBe("d1");
    expect(resolveDoc(docs, "Untitled").id).toBe("d2");
  });

  it("finds channels with or without # and direct messages by name", () => {
    const conversations = [
      { id: "c1", kind: "public", name: "general", member_ids: [], self_dm: false },
      { id: "c2", kind: "dm", name: "", member_ids: ["u1", "u2"], self_dm: false },
    ] as unknown as Conversation[];
    const names = new Map(members.map((m) => [m.user_id, m.display_name]));
    expect(resolveConversation(conversations, "#general", names, "u1").id).toBe("c1");
    expect(resolveConversation(conversations, "general", names, "u1").id).toBe("c1");
    expect(resolveConversation(conversations, "Ana Lopez", names, "u1").id).toBe("c2");
  });
});

describe("parseDueDate", () => {
  it("makes a date the end of that local day, and keeps timestamps", () => {
    const due = new Date(parseDueDate("2026-11-20")!);
    expect([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours(), due.getMinutes()]).toEqual([
      2026, 10, 20, 23, 59,
    ]);
    expect(parseDueDate("2026-11-20T10:00:00.000Z")).toBe("2026-11-20T10:00:00.000Z");
  });

  it("clears with none and refuses text that is not a date", () => {
    expect(parseDueDate("none")).toBeNull();
    expect(() => parseDueDate("2026-02-30")).toThrow(/not a valid date/);
    expect(() => parseDueDate("next friday")).toThrow(/ISO 8601/);
  });
});
