import { Form, type LaunchProps } from "@raycast/api";

import { Guard } from "./components/Guard";
import { TaskForm, type TaskFormValues } from "./components/TaskForm";

export default function Command({ draftValues }: LaunchProps<{ draftValues: TaskFormValues }>) {
  return (
    <Guard scope="tasks:write" loading={<Form isLoading />}>
      {(orbit) => <TaskForm orbit={orbit} draftValues={draftValues} />}
    </Guard>
  );
}
