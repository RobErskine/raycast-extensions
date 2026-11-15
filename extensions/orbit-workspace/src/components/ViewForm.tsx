import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useEffect } from "react";

import { PRIORITIES } from "../api/types";
import type { Orbit } from "../hooks/useOrbit";
import { useViews } from "../hooks/useViews";
import { useLabels, useMembers, useProjects, useStatuses } from "../hooks/useWorkspaceData";
import { showError } from "../lib/errors";
import { colorDot, priorityIcon, PRIORITY_TITLE, statusIcon } from "../lib/presentation";
import { EMPTY_FILTER, SORT_TITLE, type ViewFilter, type ViewSort, type ViewState } from "../lib/views";

interface Values {
  name: string;
  projectId: string;
  statusId: string;
  state: string;
  assignee: string;
  priority: string;
  labelId: string;
  query: string;
  sort: string;
}

interface ViewFormProps {
  orbit: Orbit;
  navigationTitle: string;
  submitTitle: string;
  name?: string;
  filter?: ViewFilter;
  onSubmit: (name: string, filter: ViewFilter) => Promise<void>;
}

/** The name and filters of a task view. */
export function ViewForm({ orbit, navigationTitle, submitTitle, name, filter, onSubmit }: ViewFormProps) {
  const { pop } = useNavigation();
  const initial = filter ?? EMPTY_FILTER;
  const { projects } = useProjects(orbit);
  const { members } = useMembers(orbit);

  const { handleSubmit, itemProps, values, setValue } = useForm<Values>({
    initialValues: { name: name ?? "", ...initial },
    validation: {
      name: (value) => {
        if (!value?.trim()) return "The name is required";
        if (value.trim().length > 80) return "The name can have at most 80 characters";
      },
    },
    async onSubmit(form) {
      const inProject = Boolean(form.projectId);
      try {
        await onSubmit(form.name.trim(), {
          projectId: form.projectId,
          // Statuses and labels belong to one project.
          statusId: inProject ? form.statusId : "",
          labelId: inProject ? form.labelId : "",
          state: form.state as ViewState,
          assignee: form.assignee,
          priority: form.priority as ViewFilter["priority"],
          query: form.query.trim(),
          sort: form.sort as ViewSort,
        });
        pop();
      } catch (error) {
        await showError(error, "Could not save the view");
      }
    },
  });

  const projectIds = values.projectId ? [values.projectId] : [];
  const statuses = useStatuses(orbit, projectIds).byProject.get(values.projectId) ?? [];
  const labels = useLabels(orbit, projectIds).labels;

  // Statuses and labels belong to one project: drop those of a project that is no longer chosen.
  useEffect(() => {
    if (values.statusId && statuses.length > 0 && !statuses.some((s) => s.id === values.statusId)) {
      setValue("statusId", "");
    }
    if (values.labelId && labels.length > 0 && !labels.some((l) => l.id === values.labelId)) setValue("labelId", "");
  }, [values.projectId, statuses, labels]);

  return (
    <Form
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={submitTitle} icon={Icon.SaveDocument} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Name" placeholder="For example: DBM Open Tasks" autoFocus {...itemProps.name} />
      <Form.Separator />
      <Form.Dropdown title="Project" {...itemProps.projectId}>
        <Form.Dropdown.Item value="" title="All Projects" icon={Icon.Layers} />
        {projects.map((project) => (
          <Form.Dropdown.Item
            key={project.id}
            value={project.id}
            title={`${project.name} (${project.key})`}
            icon={colorDot(project.color)}
          />
        ))}
      </Form.Dropdown>
      {values.projectId && statuses.length > 0 && (
        <Form.Dropdown title="Status" info="One status of the project, or any status." {...itemProps.statusId}>
          <Form.Dropdown.Item value="" title="Any Status" icon={Icon.Circle} />
          {statuses.map((status) => (
            <Form.Dropdown.Item key={status.id} value={status.id} title={status.name} icon={statusIcon(status)} />
          ))}
        </Form.Dropdown>
      )}
      {!(values.projectId && values.statusId) && (
        <Form.Dropdown title="Show" {...itemProps.state}>
          <Form.Dropdown.Item value="open" title="Open Tasks" icon={Icon.Circle} />
          <Form.Dropdown.Item value="done" title="Done Tasks" icon={Icon.CheckCircle} />
          <Form.Dropdown.Item value="all" title="All Tasks" icon={Icon.Layers} />
        </Form.Dropdown>
      )}
      <Form.Dropdown title="Assignee" {...itemProps.assignee}>
        <Form.Dropdown.Item value="" title="Anyone" icon={Icon.TwoPeople} />
        {orbit.userId && <Form.Dropdown.Item value="me" title="Me" icon={Icon.Person} />}
        <Form.Dropdown.Item value="none" title="Nobody" icon={Icon.PersonCircle} />
        <Form.Dropdown.Section title="Members">
          {members
            .filter((m) => m.user_id !== orbit.userId)
            .map((member) => (
              <Form.Dropdown.Item
                key={member.user_id}
                value={member.user_id}
                title={member.display_name}
                icon={Icon.Person}
              />
            ))}
        </Form.Dropdown.Section>
      </Form.Dropdown>
      <Form.Dropdown title="Priority" {...itemProps.priority}>
        <Form.Dropdown.Item value="" title="Any Priority" icon={Icon.Minus} />
        {PRIORITIES.map((priority) => (
          <Form.Dropdown.Item
            key={priority}
            value={priority}
            title={PRIORITY_TITLE[priority]}
            icon={priorityIcon(priority)}
          />
        ))}
      </Form.Dropdown>
      {values.projectId && labels.length > 0 && (
        <Form.Dropdown title="Label" {...itemProps.labelId}>
          <Form.Dropdown.Item value="" title="Any Label" icon={Icon.Tag} />
          {labels.map((label) => (
            <Form.Dropdown.Item key={label.id} value={label.id} title={label.name} icon={colorDot(label.color)} />
          ))}
        </Form.Dropdown>
      )}
      <Form.TextField
        title="Text"
        placeholder="Optional: words in the title or description"
        info="Typing in the view's search bar replaces this text."
        {...itemProps.query}
      />
      <Form.Dropdown title="Sort By" {...itemProps.sort}>
        {(Object.keys(SORT_TITLE) as ViewSort[]).map((sort) => (
          <Form.Dropdown.Item key={sort} value={sort} title={SORT_TITLE[sort]} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

/** Saves a filter as a new view. */
export function SaveViewForm({ orbit, filter, name }: { orbit: Orbit; filter: ViewFilter; name?: string }) {
  const { create } = useViews(orbit);
  return (
    <ViewForm
      orbit={orbit}
      navigationTitle="Save as View"
      submitTitle="Save View"
      name={name}
      filter={filter}
      onSubmit={async (viewName, viewFilter) => {
        await create(viewName, viewFilter);
        await showToast({ style: Toast.Style.Success, title: `Saved ${viewName}`, message: "Open it with Task Views" });
      }}
    />
  );
}
