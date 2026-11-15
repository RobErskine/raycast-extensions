import { LocalStorage } from "@raycast/api";

import { parseViews, type TaskView } from "./views";

/** Each Orbit URL has its own views. */
export function viewsKey(base: string): string {
  return `task-views:${base}`;
}

export async function readViews(key: string): Promise<TaskView[]> {
  try {
    return parseViews(JSON.parse((await LocalStorage.getItem<string>(key)) ?? "[]"));
  } catch {
    return [];
  }
}
