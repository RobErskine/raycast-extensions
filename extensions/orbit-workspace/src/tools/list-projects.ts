import { openOrbit, withErrors } from "../ai/context";

/** The projects that the token can use, each with its statuses (in workflow order) and labels. */
export default async function () {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:read");
    const projects = await orbit.projects();
    return Promise.all(
      projects.map(async (project) => ({
        key: project.key,
        name: project.name,
        statuses: (await orbit.statusesOf(project.id))
          .sort((a, b) => a.position - b.position)
          .map((s) => ({ name: s.name, category: s.category })),
        labels: (await orbit.labelsOf(project.id)).map((l) => l.name),
      })),
    );
  });
}
