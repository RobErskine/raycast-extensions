import { Action, ActionPanel, Alert, Color, confirmAlert, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import type { MutatePromise } from "@raycast/utils";
import type { ReactNode } from "react";

import { PRIORITIES, type Status, type Task, type TaskPatch } from "../api/types";
import type { Orbit } from "../hooks/useOrbit";
import { showError } from "../lib/errors";
import { refreshMenuBar } from "../lib/menu-bar";
import { priorityIcon, PRIORITY_TITLE, statusIcon } from "../lib/presentation";
import { withVersionRetry } from "../lib/retry";
import { doneStatus } from "../lib/tasks";

import { CommentForm } from "./CommentForm";
import { TaskForm } from "./TaskForm";

type Change = Omit<TaskPatch, "expected_version">;

interface TaskActionsProps {
  orbit: Orbit;
  task: Task;
  /** The statuses of the task's project, by position. */
  statuses: Status[];
  mutate: MutatePromise<Task[]>;
  revalidate: () => void;
  /** List-level actions (toggles); shown after the task actions. */
  listActions?: ReactNode;
}

export function TaskActions({ orbit, task, statuses, mutate, revalidate, listActions }: TaskActionsProps) {
  const canWrite = orbit.hasScope("tasks:write");
  const done = doneStatus(statuses);
  const mine = orbit.userId ? task.assignee_ids.includes(orbit.userId) : false;

  /**
   * Writes a change computed from the latest task. The list shows it at once, then shows the task
   * that Orbit returns. It is not reloaded: that would drop the pages loaded after the first.
   */
  async function update(title: string, change: (current: Task) => Change) {
    const toast = await showToast({ style: Toast.Style.Animated, title });
    const replace = (next: (t: Task) => Task) => (tasks: Task[] | undefined) =>
      (tasks ?? []).map((t) => (t.id === task.id ? next(t) : t));
    try {
      const saved = await mutate(
        withVersionRetry(
          task,
          () => orbit.client.getTask(task.id),
          (current) => orbit.client.updateTask(task.id, { ...change(current), expected_version: current.version }),
        ),
        { optimisticUpdate: replace((t) => ({ ...t, ...change(t) })), shouldRevalidateAfter: false },
      );
      await mutate(Promise.resolve(), { optimisticUpdate: replace(() => saved), shouldRevalidateAfter: false });
      refreshMenuBar();
      toast.style = Toast.Style.Success;
      toast.title = `Updated ${task.identifier}`;
    } catch (error) {
      await toast.hide();
      await showError(error, `Could not update ${task.identifier}`);
    }
  }

  async function moveToTrash() {
    const confirmed = await confirmAlert({
      title: `Move ${task.identifier} to the trash?`,
      message: "Its sub-issues go with it. You can restore them in Orbit for 30 days.",
      icon: { source: Icon.Trash, tintColor: Color.Red },
      primaryAction: { title: "Move to Trash", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    const toast = await showToast({ style: Toast.Style.Animated, title: "Moving to trash…" });
    try {
      // No retry on a version conflict: the user confirmed the task as they saw it.
      await mutate(orbit.client.deleteTask(task.id, task.version), {
        optimisticUpdate: (tasks) => (tasks ?? []).filter((t) => t.id !== task.id),
        shouldRevalidateAfter: false,
      });
      refreshMenuBar();
      toast.style = Toast.Style.Success;
      toast.title = `Moved ${task.identifier} to the trash`;
    } catch (error) {
      await toast.hide();
      await showError(error, `Could not delete ${task.identifier}`);
    }
  }

  return (
    <ActionPanel title={task.identifier}>
      <ActionPanel.Section>
        <Action.OpenInBrowser title="Open in Orbit" url={task.url} />
        {canWrite && done && task.status_id !== done.id && (
          <Action
            title="Mark as Done"
            icon={statusIcon(done)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
            onAction={() => update("Marking as done…", () => ({ status_id: done.id }))}
          />
        )}
      </ActionPanel.Section>
      {canWrite && (
        <ActionPanel.Section>
          <ActionPanel.Submenu title="Change Status" icon={Icon.Circle} shortcut={Keyboard.Shortcut.Common.Save}>
            {statuses.map((status) => (
              <Action
                key={status.id}
                title={status.id === task.status_id ? `${status.name} (Current)` : status.name}
                icon={statusIcon(status)}
                onAction={() => update("Changing status…", () => ({ status_id: status.id }))}
              />
            ))}
          </ActionPanel.Submenu>
          <ActionPanel.Submenu
            title="Change Priority"
            icon={Icon.Signal3}
            shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
          >
            {PRIORITIES.map((priority) => (
              <Action
                key={priority}
                title={priority === task.priority ? `${PRIORITY_TITLE[priority]} (Current)` : PRIORITY_TITLE[priority]}
                icon={priorityIcon(priority)}
                onAction={() => update("Changing priority…", () => ({ priority }))}
              />
            ))}
          </ActionPanel.Submenu>
          {orbit.userId && (
            <Action
              title={mine ? "Unassign Me" : "Assign to Me"}
              icon={Icon.Person}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
              onAction={() =>
                update(mine ? "Unassigning…" : "Assigning…", (current) => ({
                  assignee_ids: mine
                    ? current.assignee_ids.filter((id) => id !== orbit.userId)
                    : [...new Set([...current.assignee_ids, orbit.userId!])],
                }))
              }
            />
          )}
          <Action.Push
            title="Add Comment"
            icon={Icon.Bubble}
            shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
            target={<CommentForm orbit={orbit} task={task} />}
          />
          <Action.Push
            title="Create Task in Project"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={<TaskForm orbit={orbit} projectId={task.project_id} onCreated={() => revalidate()} />}
          />
        </ActionPanel.Section>
      )}
      <ActionPanel.Section>
        <Action.CopyToClipboard
          title="Copy Identifier"
          content={task.identifier}
          shortcut={Keyboard.Shortcut.Common.Pin}
        />
        <Action.CopyToClipboard title="Copy URL" content={task.url} shortcut={Keyboard.Shortcut.Common.Copy} />
        <Action.CopyToClipboard
          title="Copy Identifier and Title"
          content={`${task.identifier} ${task.title}`}
          shortcut={{ modifiers: ["cmd", "shift"], key: "." }}
        />
      </ActionPanel.Section>
      {listActions}
      {canWrite && (
        <ActionPanel.Section>
          <Action
            title="Move to Trash"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={Keyboard.Shortcut.Common.Remove}
            onAction={moveToTrash}
          />
        </ActionPanel.Section>
      )}
    </ActionPanel>
  );
}
