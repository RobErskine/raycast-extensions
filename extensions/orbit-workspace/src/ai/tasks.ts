import { fillPage } from "../api/pagination";
import type { NewTask, Priority, Task, TaskPatch } from "../api/types";
import { readViews, viewsKey } from "../lib/view-storage";
import { EMPTY_FILTER, matchesState, viewQuery, type ViewFilter, type ViewSort, type ViewState } from "../lib/views";

import type { OrbitContext } from "./context";
import {
  matchingStatusIds,
  parseDueDate,
  resolveAssignee,
  resolveLabel,
  resolveMember,
  resolveProject,
  resolveStatus,
  ResolveError,
} from "./resolve";
import { serializeTask } from "./serialize";

export interface TaskFilterInput {
  view?: string;
  project?: string;
  status?: string;
  state?: ViewState;
  assignee?: string;
  priority?: Priority;
  label?: string;
  query?: string;
  sort?: ViewSort;
  limit?: number;
  cursor?: string;
}

const MAX_LIMIT = 100;

/** Lists tasks for the AI: a saved view and/or filters given by name. */
export async function listTasks(orbit: OrbitContext, input: TaskFilterInput) {
  let filter: ViewFilter = { ...EMPTY_FILTER };
  if (input.view) {
    const views = await readViews(viewsKey(orbit.base));
    const wanted = input.view.trim().toLowerCase();
    const view = views.find((v) => v.id === input.view || v.name.toLowerCase() === wanted);
    if (!view) {
      throw new ResolveError(
        `No saved task view is named "${input.view}". Views: ${views.map((v) => v.name).join(", ") || "none"}.`,
      );
    }
    filter = { ...view.filter };
  }

  const project = input.project ? resolveProject(await orbit.projects(), input.project) : undefined;
  if (project) filter = { ...filter, projectId: project.id, statusId: "", labelId: "" };
  if (input.state) filter.state = input.state;
  if (input.priority) filter.priority = input.priority;
  if (input.sort) filter.sort = input.sort;
  if (input.query !== undefined) filter.query = input.query;
  if (input.assignee) filter.assignee = resolveAssignee(await orbit.members(), input.assignee, orbit.userId);
  if (filter.assignee === "me" && !orbit.userId) {
    throw new ResolveError("This API token is a service account, so it has no 'me'.");
  }

  // A status or label name: one ID inside a project, else a set of IDs that is filtered here.
  let statusIds: Set<string> | undefined;
  if (input.status) {
    // A status replaces the open/done filter: "done" tasks are not open.
    filter.state = "all";
    if (filter.projectId) filter.statusId = resolveStatus(await orbit.statusesOf(filter.projectId), input.status).id;
    else statusIds = matchingStatusIds(await orbit.allStatuses(), input.status);
  }
  let labelIds: Set<string> | undefined;
  if (input.label) {
    if (filter.projectId) filter.labelId = resolveLabel(await orbit.labelsOf(filter.projectId), input.label).id;
    else {
      const labels = (await orbit.allLabels()).filter(
        (l) => l.name.toLowerCase() === input.label!.trim().toLowerCase(),
      );
      if (labels.length === 0) throw new ResolveError(`No label is named "${input.label}".`);
      labelIds = new Set(labels.map((l) => l.id));
    }
  }

  const names = await orbit.names();
  const limit = Math.min(Math.max(input.limit ?? 25, 1), MAX_LIMIT);
  const params = viewQuery(filter, orbit.userId);
  const keep = (task: Task) =>
    matchesState(task, filter, names.statuses) &&
    (!statusIds || statusIds.has(task.status_id)) &&
    (!labelIds || task.label_ids.some((id) => labelIds!.has(id)));
  const page = await fillPage(
    (cursor) => orbit.client.listTasks({ ...params, cursor, limit: 50 }),
    keep,
    input.cursor,
    limit,
    20,
  );
  return {
    // Not cut to `limit`: the cursor continues after the last API page, so cut tasks would be lost.
    tasks: page.data.map((task) => serializeTask(task, names)),
    nextCursor: page.hasMore ? (page.cursor ?? null) : null,
  };
}

export interface TaskFieldsInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: Priority;
  assignees?: string[];
  labels?: string[];
  dueDate?: string;
}

/** Turns names into the fields of a task write, for one project. */
async function resolveFields(orbit: OrbitContext, projectId: string, input: TaskFieldsInput) {
  const statuses = await orbit.statusesOf(projectId);
  const status = input.status ? resolveStatus(statuses, input.status) : undefined;
  const members = input.assignees ? await orbit.members() : [];
  const assigneeIds = input.assignees
    ? [...new Set(input.assignees.map((name) => resolveMember(members, name, orbit.userId)))]
    : undefined;
  const labels = input.labels ? await orbit.labelsOf(projectId) : [];
  const labelList = input.labels ? input.labels.map((name) => resolveLabel(labels, name)) : undefined;
  const dueAt = input.dueDate !== undefined ? parseDueDate(input.dueDate) : undefined;
  const memberNames = new Map((await orbit.members()).map((m) => [m.user_id, m.display_name]));
  return {
    status,
    assigneeIds,
    labelIds: labelList?.map((l) => l.id),
    dueAt,
    /** For the confirmation. */
    info: [
      { name: "Status", value: status?.name },
      { name: "Priority", value: input.priority },
      { name: "Assignees", value: assigneeIds?.map((id) => memberNames.get(id) ?? id).join(", ") || undefined },
      { name: "Labels", value: labelList?.map((l) => l.name).join(", ") || undefined },
      { name: "Due", value: dueAt === null ? "No due date" : dueAt ? new Date(dueAt).toLocaleDateString() : undefined },
    ],
  };
}

export interface CreateTaskInput extends TaskFieldsInput {
  project: string;
  title: string;
}

export async function prepareCreateTask(orbit: OrbitContext, input: CreateTaskInput) {
  if (!input.title?.trim()) throw new ResolveError("The task needs a title.");
  const project = resolveProject(await orbit.projects(), input.project);
  const fields = await resolveFields(orbit, project.id, input);
  const status = fields.status ?? resolveStatus(await orbit.statusesOf(project.id), "open");
  const body: NewTask = {
    project_id: project.id,
    status_id: status.id,
    title: input.title.trim(),
    description: input.description,
    priority: input.priority,
    assignee_ids: fields.assigneeIds,
    label_ids: fields.labelIds,
    due_at: fields.dueAt ?? undefined,
  };
  return {
    body,
    info: [
      { name: "Project", value: `${project.name} (${project.key})` },
      { name: "Title", value: body.title },
      ...fields.info.map((row) => (row.name === "Status" ? { name: "Status", value: status.name } : row)),
    ],
  };
}

export interface UpdateTaskInput extends TaskFieldsInput {
  task: string;
}

export async function prepareUpdateTask(orbit: OrbitContext, input: UpdateTaskInput) {
  const task = await orbit.client.getTask(input.task.trim());
  const fields = await resolveFields(orbit, task.project_id, input);
  const patch: Omit<TaskPatch, "expected_version"> = {
    title: input.title?.trim() || undefined,
    description: input.description,
    status_id: fields.status?.id,
    priority: input.priority,
    assignee_ids: fields.assigneeIds,
    label_ids: fields.labelIds,
    due_at: fields.dueAt,
  };
  const changes = Object.values(patch).filter((value) => value !== undefined).length;
  if (changes === 0) throw new ResolveError("Nothing to change: give at least one field to update.");
  return {
    task,
    patch,
    info: [
      { name: "Task", value: `${task.identifier}: ${task.title}` },
      { name: "New title", value: patch.title },
      { name: "Description", value: input.description !== undefined ? "Replaced" : undefined },
      ...fields.info,
    ],
  };
}
