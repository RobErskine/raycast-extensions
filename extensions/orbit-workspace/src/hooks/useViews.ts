import { LocalStorage } from "@raycast/api";
import { randomUUID } from "node:crypto";

import { readViews, viewsKey } from "../lib/view-storage";
import { moveView, type TaskView, type ViewFilter } from "../lib/views";

import type { Orbit } from "./useOrbit";
import { useQuery } from "./useQuery";

/** Writes of all screens run in order, so a fast second change cannot undo the first. */
let writes: Promise<unknown> = Promise.resolve();

/**
 * The task views of this Orbit, in the order the user chose. They are stored in the extension's
 * LocalStorage, and read through the shared cache so that every open screen sees a change.
 */
export function useViews(orbit: Orbit) {
  const key = viewsKey(orbit.client.base);
  const { data, isLoading, mutate } = useQuery(["task-views", key], () => readViews(key));
  const views = data ?? [];

  /** Applies a change to the stored views (not to this render's copy), one change at a time. */
  function save(change: (current: TaskView[]) => TaskView[]): Promise<void> {
    const write = writes.then(async () => {
      const next = change(await readViews(key));
      await mutate(LocalStorage.setItem(key, JSON.stringify(next)), {
        optimisticUpdate: () => next,
        shouldRevalidateAfter: false,
      });
    });
    writes = write.catch(() => undefined);
    return write;
  }

  return {
    views,
    isLoading,
    create: async (name: string, filter: ViewFilter): Promise<TaskView> => {
      const view = { id: randomUUID(), name, filter };
      await save((current) => [...current, view]);
      return view;
    },
    update: (view: TaskView) => save((current) => current.map((v) => (v.id === view.id ? view : v))),
    remove: (id: string) => save((current) => current.filter((v) => v.id !== id)),
    move: (id: string, offset: number) =>
      save((current) =>
        moveView(
          current,
          current.findIndex((v) => v.id === id),
          offset,
        ),
      ),
  };
}
