import { Icon, launchCommand, LaunchType, MenuBarExtra, open } from "@raycast/api";
import { apiHost } from "./lib/api";
import { withFaite } from "./lib/auth";
import { todoUrl, useOverflow, useToday, useTodos } from "./lib/hooks";

/**
 * Today's count in the menu bar, with the day's to-dos behind it.
 *
 * Overflow is surfaced separately rather than folded into the count: the
 * whole point of the Faite Loop is that slipped work is a different category
 * from today's work, and a single number would hide exactly the thing the
 * mechanic exists to make visible.
 */
function FaiteMenuBar() {
  const today = useToday();
  const { data: todos, isLoading } = useTodos({ scheduledDate: today, status: "open" });
  const { data: overflowAll, isLoading: loadingOverflow } = useOverflow();

  const rows = todos ?? [];
  const overflow = (overflowAll ?? []).filter((todo) => todo.status === "open");

  return (
    <MenuBarExtra
      icon={Icon.Circle}
      // The count is today's open work. `undefined` while loading rather than
      // "0", which would read as "nothing to do" for a second on every wake.
      title={isLoading ? undefined : String(rows.length)}
      isLoading={isLoading || loadingOverflow}
      tooltip="Faite"
    >
      <MenuBarExtra.Section title={rows.length === 1 ? "1 to-do today" : `${rows.length} to-dos today`}>
        {rows.slice(0, 10).map((todo) => (
          <MenuBarExtra.Item key={todo.id} title={todo.title} onAction={() => open(todoUrl(todo.id))} />
        ))}
        {rows.length > 10 && (
          <MenuBarExtra.Item
            title={`…and ${rows.length - 10} more`}
            onAction={() => launchCommand({ name: "today", type: LaunchType.UserInitiated })}
          />
        )}
      </MenuBarExtra.Section>

      {overflow.length > 0 && (
        <MenuBarExtra.Section title={`${overflow.length} in Overflow`}>
          <MenuBarExtra.Item
            title="Triage Overflow"
            icon={Icon.Clock}
            onAction={() => launchCommand({ name: "overflow", type: LaunchType.UserInitiated })}
          />
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Quick Add To-Do"
          icon={Icon.Plus}
          onAction={() => launchCommand({ name: "quick-add-todo", type: LaunchType.UserInitiated })}
        />
        <MenuBarExtra.Item title="Open Faite" icon={Icon.Globe} onAction={() => open(`${apiHost()}/board`)} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

export default withFaite(FaiteMenuBar);
