import { Form, type LaunchProps } from "@raycast/api";

import { DocForm, type DocFormValues } from "./components/DocForm";
import { Guard } from "./components/Guard";

export default function Command({ draftValues }: LaunchProps<{ draftValues: DocFormValues }>) {
  return (
    <Guard scope="docs:write" loading={<Form isLoading />}>
      {(orbit) => <DocForm orbit={orbit} draftValues={draftValues} />}
    </Guard>
  );
}
