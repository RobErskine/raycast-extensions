import { Action, ActionPanel, Clipboard, Form, Icon, open, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, useCachedState, useForm } from "@raycast/utils";
import { useEffect } from "react";

import { PRIORITIES, type Priority, type Task } from "../api/types";
import type { Orbit } from "../hooks/useOrbit";
import { useLabels, useMembers, useProjects, useStatuses } from "../hooks/useWorkspaceData";
import { showError } from "../lib/errors";
import { refreshMenuBar } from "../lib/menu-bar";
import { colorDot, priorityIcon, PRIORITY_TITLE, statusIcon } from "../lib/presentation";
import { defaultStatus, endOfDayIso } from "../lib/tasks";

export interface TaskFormValues {
  projectId: string;
  title: string;
  description: string;
  statusId: string;
  priority: string;
  assigneeIds: string[];
  labelIds: string[];
  dueDate: Date | null;
}

interface TaskFormProps {
  orbit: Orbit;
  /** Preselects this project. */
  projectId?: string;
  /** Set when the form is pushed from another view: it pops after the task is created. */
  onCreated?: (task: Task) => void;
  /** What the user typed before Raycast closed (command root only). */
  draftValues?: Partial<TaskFormValues>;
}

export function TaskForm({ orbit, projectId, onCreated, draftValues }: TaskFormProps) {
  const { pop } = useNavigation();
  const [lastProjectId, setLastProjectId] = useCachedState("create-task.last-project", "");
  const { projects, isLoading: projectsLoading } = useProjects(orbit);
  const { members } = useMembers(orbit);

  const { handleSubmit, itemProps, values, setValue, reset, focus } = useForm<TaskFormValues>({
    initialValues: {
      projectId: projectId ?? lastProjectId,
      priority: "none",
      assigneeIds: [],
      labelIds: [],
      dueDate: null,
      ...draftValues,
      ...(draftValues?.dueDate ? { dueDate: new Date(draftValues.dueDate) } : {}),
    },
    validation: {
      projectId: FormValidation.Required,
      statusId: FormValidation.Required,
      title: (value) => {
        if (!value?.trim()) return "The title is required";
        if (value.length > 500) return "The title can have at most 500 characters";
      },
    },
    async onSubmit(form) {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Creating task…" });
      try {
        const task = await orbit.client.createTask({
          project_id: form.projectId,
          status_id: form.statusId,
          title: form.title.trim(),
          description: form.description || undefined,
          priority: form.priority as Priority,
          assignee_ids: form.assigneeIds,
          label_ids: form.labelIds,
          due_at: form.dueDate ? endOfDayIso(form.dueDate) : undefined,
        });
        setLastProjectId(form.projectId);
        refreshMenuBar();
        toast.style = Toast.Style.Success;
        toast.title = `Created ${task.identifier}`;
        toast.message = task.title;
        toast.primaryAction = { title: "Open in Orbit", onAction: () => open(task.url) };
        toast.secondaryAction = { title: "Copy Identifier", onAction: () => Clipboard.copy(task.identifier) };
        if (onCreated) {
          onCreated(task);
          pop();
        } else {
          reset({ ...form, title: "", description: "", assigneeIds: [], labelIds: [], dueDate: null });
          focus("title");
        }
      } catch (error) {
        await toast.hide();
        await showError(error, "Could not create the task");
      }
    },
  });

  // Choose a project when the remembered one is gone, or when there is only one.
  useEffect(() => {
    if (projects.length === 0) return;
    if (!projects.some((p) => p.id === values.projectId)) setValue("projectId", projects[0].id);
  }, [projects, values.projectId]);

  const statuses = useStatuses(orbit, values.projectId ? [values.projectId] : []);
  const labels = useLabels(orbit, values.projectId ? [values.projectId] : []);
  const projectStatuses = statuses.byProject.get(values.projectId) ?? [];
  const projectLabels = labels.labels.filter((l) => l.project_id === values.projectId);

  // A new project has other statuses and labels: pick its default status and drop old labels.
  useEffect(() => {
    if (projectStatuses.length === 0) return;
    if (!projectStatuses.some((s) => s.id === values.statusId)) {
      setValue("statusId", defaultStatus(projectStatuses)?.id ?? "");
    }
    const kept = values.labelIds.filter((id) => projectLabels.some((l) => l.id === id));
    if (kept.length !== values.labelIds.length) setValue("labelIds", kept);
  }, [values.projectId, projectStatuses.length, projectLabels.length]);

  return (
    <Form
      isLoading={projectsLoading || statuses.isLoading}
      // Root screens take the command's title; drafts are kept for the command only.
      navigationTitle={onCreated ? "Create Task" : undefined}
      enableDrafts={!onCreated}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown title="Project" {...itemProps.projectId}>
        {projects.map((project) => (
          <Form.Dropdown.Item
            key={project.id}
            value={project.id}
            title={`${project.name} (${project.key})`}
            icon={colorDot(project.color)}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField title="Title" placeholder="What needs to be done?" autoFocus {...itemProps.title} />
      <Form.TextArea
        title="Description"
        placeholder="Add details in Markdown"
        enableMarkdown
        {...itemProps.description}
      />
      <Form.Separator />
      <Form.Dropdown title="Status" {...itemProps.statusId}>
        {projectStatuses.map((status) => (
          <Form.Dropdown.Item key={status.id} value={status.id} title={status.name} icon={statusIcon(status)} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown title="Priority" {...itemProps.priority}>
        {PRIORITIES.map((priority) => (
          <Form.Dropdown.Item
            key={priority}
            value={priority}
            title={PRIORITY_TITLE[priority]}
            icon={priorityIcon(priority)}
          />
        ))}
      </Form.Dropdown>
      <Form.TagPicker title="Assignees" placeholder="Nobody" {...itemProps.assigneeIds}>
        {members.map((member) => (
          <Form.TagPicker.Item
            key={member.user_id}
            value={member.user_id}
            title={member.user_id === orbit.userId ? `${member.display_name} (you)` : member.display_name}
            icon={Icon.Person}
          />
        ))}
      </Form.TagPicker>
      {projectLabels.length > 0 && (
        <Form.TagPicker title="Labels" placeholder="No labels" {...itemProps.labelIds}>
          {projectLabels.map((label) => (
            <Form.TagPicker.Item key={label.id} value={label.id} title={label.name} icon={colorDot(label.color)} />
          ))}
        </Form.TagPicker>
      )}
      <Form.DatePicker title="Due Date" type={Form.DatePicker.Type.Date} {...itemProps.dueDate} />
    </Form>
  );
}
