import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  type LaunchProps,
} from "@raycast/api";
import { createDeeplink } from "@raycast/utils";
import { useMemo } from "react";

import { Guard } from "./components/Guard";
import { TaskList } from "./components/TaskList";
import { ViewForm } from "./components/ViewForm";
import type { Orbit } from "./hooks/useOrbit";
import { useViews } from "./hooks/useViews";
import { useLabels, useMembers, useProjects, useStatuses } from "./hooks/useWorkspaceData";
import { colorDot } from "./lib/presentation";
import { describeView, parseView, SORT_TITLE, type Names, type TaskView } from "./lib/views";

/** A quicklink opens this command with the view in its context. */
interface ViewContext {
  view?: unknown;
}

export default function Command({ launchContext }: LaunchProps<{ launchContext?: ViewContext }>) {
  const linked = parseView(launchContext?.view);
  return (
    <Guard scope="tasks:read">
      {(orbit) => (linked ? <LinkedView orbit={orbit} snapshot={linked} /> : <TaskViews orbit={orbit} />)}
    </Guard>
  );
}

/** The deeplink of a view. It holds the whole view, so it also works where the view is not saved. */
function viewDeeplink(view: TaskView): string {
  return createDeeplink({ command: "task-views", context: { view } as unknown as LaunchProps["launchContext"] });
}

function useNames(orbit: Orbit, projectIds: string[]): Names {
  const { projects } = useProjects(orbit);
  const statuses = useStatuses(orbit, projectIds);
  const labels = useLabels(orbit, projectIds);
  const { names } = useMembers(orbit);
  return useMemo(
    () => ({
      projects: new Map(projects.map((p) => [p.id, p.name])),
      statuses: new Map(statuses.statuses.map((s) => [s.id, s.name])),
      labels: new Map(labels.labels.map((l) => [l.id, l.name])),
      members: names,
    }),
    [projects, statuses.statuses, labels.labels, names],
  );
}

function TaskViews({ orbit }: { orbit: Orbit }) {
  const { views, isLoading, create, update, remove, move } = useViews(orbit);
  const { projects } = useProjects(orbit);
  const projectIds = [...new Set(views.map((v) => v.filter.projectId).filter(Boolean))];
  const names = useNames(orbit, projectIds);

  const createAction = (
    <Action.Push
      title="Create View"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={
        <ViewForm
          orbit={orbit}
          navigationTitle="Create View"
          submitTitle="Create View"
          onSubmit={async (name, filter) => {
            await create(name, filter);
          }}
        />
      }
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter views">
      <List.EmptyView
        icon={Icon.AppWindowList}
        title="No views yet"
        description="A view is a saved task filter, for example the open tasks of one project. Press ↵ to create one, or use Save as View in Search Tasks."
        actions={<ActionPanel>{createAction}</ActionPanel>}
      />
      {views.map((view, index) => {
        const project = projects.find((p) => p.id === view.filter.projectId);
        return (
          <List.Item
            key={view.id}
            icon={project ? colorDot(project.color) : Icon.Layers}
            title={view.name}
            subtitle={describeView(view.filter, names)}
            accessories={[{ text: SORT_TITLE[view.filter.sort], tooltip: "Sort" }]}
            actions={
              <ActionPanel title={view.name}>
                <ActionPanel.Section>
                  <Action.Push title="Open View" icon={Icon.List} target={<ViewTasks orbit={orbit} view={view} />} />
                  <Action.CreateQuicklink
                    title="Create Quicklink"
                    quicklink={{ name: `Orbit: ${view.name}`, link: viewDeeplink(view) }}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
                  />
                  <Action.CopyToClipboard
                    title="Copy Deeplink"
                    content={viewDeeplink(view)}
                    shortcut={Keyboard.Shortcut.Common.CopyDeeplink}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.Push
                    title="Edit View"
                    icon={Icon.Pencil}
                    shortcut={Keyboard.Shortcut.Common.Edit}
                    target={
                      <ViewForm
                        orbit={orbit}
                        navigationTitle={`Edit ${view.name}`}
                        submitTitle="Save View"
                        name={view.name}
                        filter={view.filter}
                        onSubmit={(name, filter) => update({ ...view, name, filter })}
                      />
                    }
                  />
                  <Action
                    title="Duplicate View"
                    icon={Icon.Duplicate}
                    shortcut={Keyboard.Shortcut.Common.Duplicate}
                    onAction={async () => {
                      await create(`${view.name} Copy`.slice(0, 80), view.filter);
                      await showToast({ style: Toast.Style.Success, title: "Duplicated view" });
                    }}
                  />
                  {createAction}
                  {index > 0 && (
                    <Action
                      title="Move up"
                      icon={Icon.ArrowUp}
                      shortcut={Keyboard.Shortcut.Common.MoveUp}
                      onAction={() => move(view.id, -1)}
                    />
                  )}
                  {index < views.length - 1 && (
                    <Action
                      title="Move Down"
                      icon={Icon.ArrowDown}
                      shortcut={Keyboard.Shortcut.Common.MoveDown}
                      onAction={() => move(view.id, 1)}
                    />
                  )}
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Delete View"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.Remove}
                    onAction={async () => {
                      const confirmed = await confirmAlert({
                        title: `Delete ${view.name}?`,
                        message: "Only the view is deleted, not its tasks. Quicklinks to it keep working.",
                        icon: { source: Icon.Trash, tintColor: Color.Red },
                        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
                      });
                      if (confirmed) await remove(view.id);
                    }}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

/** A view opened from a quicklink: the saved version when it exists, else the copy in the link. */
function LinkedView({ orbit, snapshot }: { orbit: Orbit; snapshot: TaskView }) {
  const { views, isLoading } = useViews(orbit);
  if (isLoading && views.length === 0) return <List isLoading searchBarPlaceholder={`Search in ${snapshot.name}`} />;
  return <ViewTasks orbit={orbit} view={views.find((v) => v.id === snapshot.id) ?? snapshot} isRoot />;
}

function ViewTasks({ orbit, view: initial, isRoot }: { orbit: Orbit; view: TaskView; isRoot?: boolean }) {
  const { views, update } = useViews(orbit);
  // After "Edit View", show the edited version.
  const saved = views.find((v) => v.id === initial.id);
  const view = saved ?? initial;
  return (
    <TaskList
      orbit={orbit}
      filter={view.filter}
      // A quicklink opens the view as the root screen, which keeps the command title.
      navigationTitle={isRoot ? undefined : view.name}
      searchBarPlaceholder={`Search in ${view.name}`}
      viewActions={
        <>
          <Action.CreateQuicklink
            title="Create Quicklink"
            quicklink={{ name: `Orbit: ${view.name}`, link: viewDeeplink(view) }}
            shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
          />
          {saved && (
            <Action.Push
              title="Edit View"
              icon={Icon.Pencil}
              shortcut={Keyboard.Shortcut.Common.Edit}
              target={
                <ViewForm
                  orbit={orbit}
                  navigationTitle={`Edit ${view.name}`}
                  submitTitle="Save View"
                  name={view.name}
                  filter={view.filter}
                  onSubmit={(name, filter) => update({ ...view, name, filter })}
                />
              }
            />
          )}
        </>
      }
    />
  );
}
