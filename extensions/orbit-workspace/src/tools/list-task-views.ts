import { openOrbit, withErrors } from "../ai/context";
import { readViews, viewsKey } from "../lib/view-storage";
import { describeView } from "../lib/views";

/** The task views that the user saved in this extension (saved task filters). */
export default async function () {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:read");
    const [views, names] = await Promise.all([readViews(viewsKey(orbit.base)), orbit.names()]);
    const lookup = {
      projects: new Map([...names.projects].map(([id, p]) => [id, p.name])),
      statuses: new Map([...names.statuses].map(([id, s]) => [id, s.name])),
      members: names.members,
      labels: new Map<string, string>(),
    };
    return views.map((view) => ({
      name: view.name,
      filters: describeView(view.filter, lookup),
      sort: view.filter.sort,
    }));
  });
}
