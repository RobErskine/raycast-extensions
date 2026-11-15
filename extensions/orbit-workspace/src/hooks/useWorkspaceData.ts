import { useMemo } from "react";

import type { Label, Status } from "../api/types";
import { showError } from "../lib/errors";

import type { Orbit } from "./useOrbit";
import { useQuery } from "./useQuery";

const quiet = { onError: () => undefined };

/** Approved projects of the token, by name. */
export function useProjects(orbit: Orbit) {
  const { data, isLoading, revalidate } = useQuery(
    ["projects", orbit.cacheScope],
    async () => (await orbit.client.projects()).sort((a, b) => a.name.localeCompare(b.name)),
    { execute: orbit.hasScope("tasks:read"), onError: (error) => showError(error, "Could not load projects") },
  );
  return { projects: data ?? [], isLoading, revalidate };
}

/** Statuses of the given projects. */
export function useStatuses(orbit: Orbit, projectIds: string[]) {
  const key = [...projectIds].sort().join(",");
  const { data, isLoading } = useQuery(
    ["statuses", orbit.cacheScope, key],
    async () => (await Promise.all(key.split(",").map((id) => orbit.client.statuses(id)))).flat(),
    { execute: key.length > 0, ...quiet },
  );
  return useMemo(() => {
    const statuses = data ?? [];
    const byId = new Map<string, Status>(statuses.map((s) => [s.id, s]));
    const byProject = new Map<string, Status[]>();
    for (const status of [...statuses].sort((a, b) => a.position - b.position)) {
      byProject.set(status.project_id, [...(byProject.get(status.project_id) ?? []), status]);
    }
    return { statuses, byId, byProject, isLoading };
  }, [data, isLoading]);
}

/** Labels of the given projects. */
export function useLabels(orbit: Orbit, projectIds: string[]) {
  const key = [...projectIds].sort().join(",");
  const { data, isLoading } = useQuery(
    ["labels", orbit.cacheScope, key],
    async () => (await Promise.all(key.split(",").map((id) => orbit.client.labels(id)))).flat(),
    { execute: key.length > 0, ...quiet },
  );
  return useMemo(() => {
    const labels = data ?? [];
    const byId = new Map<string, Label>(labels.map((l) => [l.id, l]));
    return { labels, byId, isLoading };
  }, [data, isLoading]);
}

/** Workspace members' names by user ID. Needs `tasks:read`; empty without it. */
export function useMembers(orbit: Orbit) {
  const { data, isLoading } = useQuery(
    ["members", orbit.cacheScope],
    async () => (await orbit.client.members()).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    { execute: orbit.hasScope("tasks:read"), ...quiet },
  );
  return useMemo(() => {
    const members = data ?? [];
    return { members, names: new Map(members.map((m) => [m.user_id, m.display_name])), isLoading };
  }, [data, isLoading]);
}
