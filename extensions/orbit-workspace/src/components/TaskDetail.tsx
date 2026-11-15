import { List } from "@raycast/api";

import type { Label, Project, Status, Task } from "../api/types";
import { escapeMarkdown } from "../lib/markdown";
import { colorDot, formatDate, priorityIcon, PRIORITY_TITLE, statusIcon } from "../lib/presentation";

interface TaskDetailProps {
  task: Task;
  status?: Status;
  project?: Project;
  labels: Map<string, Label>;
  names: Map<string, string>;
}

export function TaskDetail({ task, status, project, labels, names }: TaskDetailProps) {
  const taskLabels = task.label_ids.map((id) => labels.get(id)).filter((l): l is Label => Boolean(l));
  return (
    <List.Item.Detail
      markdown={`# ${escapeMarkdown(task.title)}\n\n${task.description.trim() || "_No description_"}`}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Identifier" text={task.identifier} />
          <List.Item.Detail.Metadata.Label title="Status" text={status?.name ?? "Unknown"} icon={statusIcon(status)} />
          <List.Item.Detail.Metadata.Label
            title="Priority"
            text={PRIORITY_TITLE[task.priority]}
            icon={priorityIcon(task.priority)}
          />
          {task.assignee_ids.length > 0 ? (
            <List.Item.Detail.Metadata.TagList title="Assignees">
              {task.assignee_ids.map((id) => (
                <List.Item.Detail.Metadata.TagList.Item key={id} text={names.get(id) ?? "Member"} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          ) : (
            <List.Item.Detail.Metadata.Label title="Assignees" text="Nobody" />
          )}
          {taskLabels.length > 0 && (
            <List.Item.Detail.Metadata.TagList title="Labels">
              {taskLabels.map((label) => (
                <List.Item.Detail.Metadata.TagList.Item key={label.id} text={label.name} color={label.color} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          )}
          {task.due_at && <List.Item.Detail.Metadata.Label title="Due" text={formatDate(task.due_at)} />}
          {project && (
            <List.Item.Detail.Metadata.Label title="Project" text={project.name} icon={colorDot(project.color)} />
          )}
          <List.Item.Detail.Metadata.Label title="Updated" text={formatDate(task.updated_at)} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Link title="Orbit" text="Open in Orbit" target={task.url} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}
