import { Action, Icon, List } from "@raycast/api";
import { useCachedState } from "@raycast/utils";

import { Guard } from "./components/Guard";
import { TaskList } from "./components/TaskList";
import type { Orbit } from "./hooks/useOrbit";
import { useProjects } from "./hooks/useWorkspaceData";
import { colorDot } from "./lib/presentation";
import { EMPTY_FILTER, type ViewFilter } from "./lib/views";

export default function Command() {
  return <Guard scope="tasks:read">{(orbit) => <SearchTasks orbit={orbit} />}</Guard>;
}

function SearchTasks({ orbit }: { orbit: Orbit }) {
  const [projectId, setProjectId] = useCachedState("search-tasks.project", "");
  const [mineOnly, setMineOnly] = useCachedState("search-tasks.mine", false);
  const [hideDone, setHideDone] = useCachedState("search-tasks.hide-done", true);
  const { projects } = useProjects(orbit);

  const validProject = projects.length === 0 || projects.some((p) => p.id === projectId) ? projectId : "";
  const mine = mineOnly && Boolean(orbit.userId);
  const filter: ViewFilter = {
    ...EMPTY_FILTER,
    projectId: validProject,
    assignee: mine ? "me" : "",
    state: hideDone ? "open" : "all",
  };
  const scopeText = [mine ? "my" : "all", hideDone ? "open" : ""].filter(Boolean).join(" ");

  return (
    <TaskList
      orbit={orbit}
      filter={filter}
      searchBarPlaceholder={`Search ${scopeText} tasks by title, description or identifier`}
      emptyDescription={mine ? "Only tasks assigned to you are shown. Press ⌘⇧M to show all tasks." : undefined}
      searchBarAccessory={
        <List.Dropdown tooltip="Project" value={validProject} onChange={setProjectId}>
          <List.Dropdown.Item title="All Projects" value="" icon={Icon.Layers} />
          <List.Dropdown.Section>
            {projects.map((project) => (
              <List.Dropdown.Item
                key={project.id}
                title={project.name}
                value={project.id}
                icon={colorDot(project.color)}
                keywords={[project.key]}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      viewActions={
        <>
          {orbit.userId && (
            <Action
              title={mine ? "Show All Tasks" : "Show My Tasks"}
              icon={Icon.Person}
              shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
              onAction={() => setMineOnly(!mineOnly)}
            />
          )}
          <Action
            title={hideDone ? "Show Done Tasks" : "Hide Done Tasks"}
            icon={hideDone ? Icon.Eye : Icon.EyeDisabled}
            shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
            onAction={() => setHideDone(!hideDone)}
          />
        </>
      }
    />
  );
}
