import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";

import { fillPage, fromRestPage, type RaycastPage } from "../api/pagination";
import type { Task } from "../api/types";
import type { Orbit } from "../hooks/useOrbit";
import { useLabels, useMembers, useProjects, useStatuses } from "../hooks/useWorkspaceData";
import { showError } from "../lib/errors";
import { formatDate, priorityIcon } from "../lib/presentation";
import { matchesState, viewQuery, type ViewFilter } from "../lib/views";

import { TaskActions } from "./TaskActions";
import { TaskDetail } from "./TaskDetail";
import { SaveViewForm } from "./ViewForm";

/** With an open/done filter, one list page reads API pages until it has this many tasks… */
const MIN_PAGE_TASKS = 25;
/** …or until it has read this many API pages of 50 tasks. */
const MAX_API_PAGES = 10;

interface TaskListProps {
  orbit: Orbit;
  filter: ViewFilter;
  navigationTitle?: string;
  searchBarPlaceholder: string;
  searchBarAccessory?: ReactElement<List.Dropdown.Props>;
  /** More actions for the "View" section, for example filter toggles. */
  viewActions?: ReactNode;
  emptyDescription?: string;
}

/** Tasks that match a filter, with search, details and the task actions. */
export function TaskList({
  orbit,
  filter,
  navigationTitle,
  searchBarPlaceholder,
  searchBarAccessory,
  viewActions,
  emptyDescription,
}: TaskListProps) {
  const [searchText, setSearchText] = useState("");
  const [showDetail, setShowDetail] = useCachedState("tasks.detail", false);

  const { projects, isLoading: projectsLoading } = useProjects(orbit);
  const projectIds = projects.map((p) => p.id);
  const statuses = useStatuses(orbit, projectIds);
  const labels = useLabels(orbit, showDetail ? projectIds : []);
  const { names } = useMembers(orbit);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // A project that the token can no longer use would only give errors: list all projects instead.
  const effective = projects.length > 0 && !projectsById.has(filter.projectId) ? { ...filter, projectId: "" } : filter;
  const query = viewQuery(effective, orbit.userId, searchText);
  // "Assigned to me" has no meaning for a service-account token: show nothing rather than everything.
  const impossible = effective.assignee === "me" && !orbit.userId;

  // The API cannot filter open or done tasks, so each list page reads API pages until it has
  // enough matching tasks. Doing this in the loader (not in an effect) keeps every page of one
  // query on one cursor chain. It needs the statuses first.
  const filtersClientSide = !effective.statusId && effective.state !== "all";
  const statusesById = useRef(statuses.byId);
  statusesById.current = statuses.byId;
  const statusesReady = statuses.statuses.length > 0 || (!projectsLoading && projects.length === 0);

  const { data, isLoading, pagination, mutate, revalidate } = useCachedPromise(
    (_query: "tasks", _scope: string, serialized: string) =>
      async ({ cursor }: { cursor?: string }): Promise<RaycastPage<Task>> => {
        const params = JSON.parse(serialized);
        if (!filtersClientSide) return fromRestPage(await orbit.client.listTasks({ ...params, cursor, limit: 50 }));
        return fillPage(
          (next) => orbit.client.listTasks({ ...params, cursor: next, limit: 50 }),
          (task) => matchesState(task, effective, statusesById.current),
          cursor,
          MIN_PAGE_TASKS,
          MAX_API_PAGES,
        );
      },
    ["tasks", orbit.cacheScope, JSON.stringify(query)],
    {
      execute: !impossible && (!filtersClientSide || statusesReady),
      keepPreviousData: true,
      onError: (error) => showError(error, "Could not load tasks"),
    },
  );

  // Hides a task at once when an action marks it as done.
  const tasks = useMemo(
    () => (impossible ? [] : (data ?? []).filter((task) => matchesState(task, effective, statuses.byId))),
    [data, impossible, effective.state, effective.statusId, statuses.byId],
  );

  const listActions = (
    <ActionPanel.Section title="View">
      <Action
        title={showDetail ? "Hide Details" : "Show Details"}
        icon={Icon.Sidebar}
        shortcut={{ modifiers: ["cmd"], key: "d" }}
        onAction={() => setShowDetail(!showDetail)}
      />
      {viewActions}
      <Action.Push
        title="Save as View"
        icon={Icon.SaveDocument}
        shortcut={Keyboard.Shortcut.Common.Duplicate}
        target={
          <SaveViewForm
            orbit={orbit}
            name={projectsById.get(effective.projectId)?.name}
            filter={{ ...effective, query: searchText.trim() || effective.query }}
          />
        }
      />
      <Action
        title="Refresh"
        icon={Icon.ArrowClockwise}
        shortcut={Keyboard.Shortcut.Common.Refresh}
        onAction={() => revalidate()}
      />
    </ActionPanel.Section>
  );

  return (
    <List
      navigationTitle={navigationTitle}
      isLoading={isLoading || (filtersClientSide && !statusesReady && !impossible)}
      isShowingDetail={showDetail && tasks.length > 0}
      onSearchTextChange={setSearchText}
      throttle
      pagination={pagination}
      searchBarPlaceholder={searchBarPlaceholder}
      searchBarAccessory={searchBarAccessory}
    >
      <List.EmptyView
        icon={Icon.CheckCircle}
        title={searchText ? "No matching tasks" : "No tasks"}
        description={
          impossible
            ? "This view shows tasks assigned to you. A service-account token has no person, so it has none."
            : emptyDescription
        }
        actions={<ActionPanel>{listActions}</ActionPanel>}
      />
      {tasks.map((task) => {
        const status = statuses.byId.get(task.status_id);
        const assignees = task.assignee_ids.map((id) => names.get(id)).filter(Boolean);
        return (
          <List.Item
            key={task.id}
            id={task.id}
            icon={priorityIcon(task.priority)}
            title={task.title}
            subtitle={task.identifier}
            accessories={
              showDetail
                ? undefined
                : [
                    ...(task.due_at
                      ? [{ date: new Date(task.due_at), tooltip: `Due ${formatDate(task.due_at)}` }]
                      : []),
                    ...(assignees.length > 0 ? [{ icon: Icon.Person, tooltip: assignees.join(", ") }] : []),
                    { tag: { value: status?.name ?? "…", color: status?.color }, tooltip: "Status" },
                  ]
            }
            detail={
              <TaskDetail
                task={task}
                status={status}
                project={projectsById.get(task.project_id)}
                labels={labels.byId}
                names={names}
              />
            }
            actions={
              <TaskActions
                orbit={orbit}
                task={task}
                statuses={statuses.byProject.get(task.project_id) ?? []}
                mutate={mutate}
                revalidate={revalidate}
                listActions={listActions}
              />
            }
          />
        );
      })}
    </List>
  );
}
