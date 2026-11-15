import { launchCommand, LaunchType } from "@raycast/api";

/** Refreshes the "Orbit Tasks" menu bar after a task change. It fails when the command is off. */
export function refreshMenuBar(): void {
  launchCommand({ name: "orbit-tasks-menu-bar", type: LaunchType.Background }).catch(() => undefined);
}
