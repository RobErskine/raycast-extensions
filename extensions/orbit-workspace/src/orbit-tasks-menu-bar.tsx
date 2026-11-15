import {
  Color,
  getPreferenceValues,
  Icon,
  launchCommand,
  LaunchType,
  MenuBarExtra,
  open,
  openCommandPreferences,
  openExtensionPreferences,
  Keyboard,
} from "@raycast/api";

import { isOrbitError, OrbitError } from "./api/problem";
import type { Status, Task } from "./api/types";
import { getClient, scopeChecker } from "./api/session";
import { useQuery } from "./hooks/useQuery";
import { errorMessage } from "./lib/errors";
import { priorityIcon, statusIcon } from "./lib/presentation";
import { compareByUrgency, isDueWithin, isOpen } from "./lib/tasks";

/** Tasks shown in the menu; the rest are counted. */
const MENU_LIMIT = 15;
/** At most this many pages of 100 tasks are read (newest first). */
const MAX_PAGES = 10;

type Scope = "mine" | "all";

interface MenuTasks {
  base: string;
  tasks: Task[];
  statuses: Status[];
  serviceAccount: boolean;
  /** More tasks exist than were read: the count is a minimum. */
  capped: boolean;
}

async function loadTasks(scope: Scope): Promise<MenuTasks> {
  const client = getClient();
  const me = await client.me();
  const workspace = me.workspaces[0] ?? { ...me.workspace, scopes: me.token.scopes };
  if (!scopeChecker(workspace.scopes)("tasks:read")) {
    throw new OrbitError({ status: 403, code: "insufficient_scope", detail: "The API token needs Tasks: Read." });
  }
  const assigneeId = scope === "mine" ? me.user?.id : undefined;
  if (scope === "mine" && !assigneeId) {
    return { base: client.base, tasks: [], statuses: [], serviceAccount: true, capped: false };
  }

  const projects = await client.projects();
  const [statuses, tasks] = await Promise.all([
    Promise.all(projects.map((p) => client.statuses(p.id))).then((lists) => lists.flat()),
    (async () => {
      const all: Task[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await client.listTasks({ assignee_id: assigneeId, sort: "updated_at", limit: 100, cursor });
        all.push(...result.items);
        cursor = result.next_cursor ?? undefined;
        if (!cursor) break;
      }
      return { all, capped: cursor !== undefined };
    })(),
  ]);
  const byId = new Map(statuses.map((s) => [s.id, s]));
  return {
    base: client.base,
    tasks: tasks.all.filter((t) => isOpen(t, byId)).sort(compareByUrgency),
    statuses,
    serviceAccount: false,
    capped: tasks.capped,
  };
}

function launch(name: string) {
  return launchCommand({ name, type: LaunchType.UserInitiated });
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function Command() {
  const { apiToken, instanceUrl, show } = getPreferenceValues<Preferences.OrbitTasksMenuBar>();
  const scope: Scope = show === "all" ? "all" : "mine";
  const { data, error, isLoading } = useQuery(
    ["menu-bar-tasks", instanceUrl, apiToken.slice(-6), scope],
    () => loadTasks(scope),
    { onError: () => undefined },
  );
  const count = data ? `${data.tasks.length}${data.capped ? "+" : ""}` : "";
  const what = scope === "mine" ? "open Orbit tasks assigned to you" : "open Orbit tasks";

  const needsSetup =
    isOrbitError(error) && (error.code === "invalid_url" || error.status === 401 || error.status === 403);
  const tasks = data?.tasks ?? [];
  const statuses = new Map((data?.statuses ?? []).map((s) => [s.id, s]));
  const dueSoon = tasks.filter((t) => isDueWithin(t, 7));
  const others = tasks.filter((t) => !isDueWithin(t, 7));
  const shownDue = dueSoon.slice(0, MENU_LIMIT);
  const shownOthers = others.slice(0, Math.max(0, MENU_LIMIT - shownDue.length));
  const hidden = tasks.length - shownDue.length - shownOthers.length;

  const taskItem = (task: Task) => (
    <MenuBarExtra.Item
      key={task.id}
      icon={priorityIcon(task.priority)}
      title={truncate(task.title)}
      subtitle={`${task.identifier} · ${statuses.get(task.status_id)?.name ?? ""}`}
      tooltip={task.due_at ? `Due ${new Date(task.due_at).toLocaleDateString()}` : undefined}
      onAction={() => open(task.url)}
    />
  );

  return (
    <MenuBarExtra
      icon={{ source: "menu-bar-icon.svg", tintColor: Color.PrimaryText }}
      title={tasks.length > 0 ? count : undefined}
      tooltip={data ? `${count} ${what}` : "Orbit Tasks"}
      isLoading={isLoading}
    >
      {needsSetup && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title={errorMessage(error)} />
          <MenuBarExtra.Item title="Open Extension Preferences…" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </MenuBarExtra.Section>
      )}
      {error && !needsSetup && !data && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title={`Cannot load tasks: ${truncate(errorMessage(error), 80)}`} />
        </MenuBarExtra.Section>
      )}
      {data?.serviceAccount && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title="A service-account token has no assigned tasks." />
          <MenuBarExtra.Item title="Choose Which Tasks to Show…" icon={Icon.Gear} onAction={openCommandPreferences} />
        </MenuBarExtra.Section>
      )}
      {data && !data.serviceAccount && tasks.length === 0 && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title={`No ${what}`} icon={statusIcon(undefined)} />
          {scope === "mine" && (
            <MenuBarExtra.Item title="Choose Which Tasks to Show…" icon={Icon.Gear} onAction={openCommandPreferences} />
          )}
        </MenuBarExtra.Section>
      )}
      {shownDue.length > 0 && <MenuBarExtra.Section title="Due Soon">{shownDue.map(taskItem)}</MenuBarExtra.Section>}
      {shownOthers.length > 0 && (
        <MenuBarExtra.Section title={scope === "mine" ? "Assigned to Me" : "Open Tasks"}>
          {shownOthers.map(taskItem)}
        </MenuBarExtra.Section>
      )}
      {hidden > 0 && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title={`${hidden} more…`} onAction={() => launch("search-tasks")} />
        </MenuBarExtra.Section>
      )}
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Search Tasks"
          icon={Icon.MagnifyingGlass}
          shortcut={{ modifiers: ["cmd"], key: "f" }}
          onAction={() => launch("search-tasks")}
        />
        <MenuBarExtra.Item
          title="Create Task"
          icon={Icon.Plus}
          shortcut={Keyboard.Shortcut.Common.New}
          onAction={() => launch("create-task")}
        />
        {data?.base && (
          <MenuBarExtra.Item
            title="Open Orbit"
            icon={Icon.Globe}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={() => open(`${data.base}/tasks`)}
          />
        )}
      </MenuBarExtra.Section>
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Configure Command"
          icon={Icon.Gear}
          onAction={openCommandPreferences}
          alternate={
            <MenuBarExtra.Item title="Configure Extension" icon={Icon.Gear} onAction={openExtensionPreferences} />
          }
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
