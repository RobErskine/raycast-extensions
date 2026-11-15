import { openOrbit, withErrors } from "../ai/context";

/** The members of the Orbit workspace, to find assignees. */
export default async function () {
  return withErrors(async () => {
    const orbit = await openOrbit("tasks:read");
    return (await orbit.members()).map((m) => ({ name: m.display_name, isMe: m.user_id === orbit.userId }));
  });
}
