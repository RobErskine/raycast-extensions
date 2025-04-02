import { Form, ActionPanel, Action, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { getSlackWebClient } from "./shared/client/WebClient";
import { withSlackClient } from "./shared/withSlackClient";

interface FormValues {
  text: string;
  emoji: string;
  duration: string;
}

function SetStatus() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsLoading(true);
      const client = getSlackWebClient();

      const duration = values.duration ? parseInt(values.duration) * 60 : undefined; // Convert minutes to seconds

      await client.users.profile.set({
        profile: {
          status_text: values.text,
          status_emoji: values.emoji ? `:${values.emoji.replace(/:/g, "")}:` : "",
          status_expiration: duration ? Math.floor(Date.now() / 1000) + duration : 0,
        },
      });

      await showToast({
        style: Toast.Style.Success,
        title: values.text ? "Status updated" : "Status cleared",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to update status",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Set Status" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="text" title="Status Text" placeholder="What's happening? (leave empty to clear)" />
      <Form.TextField id="emoji" title="Emoji" placeholder="Enter emoji name without colons (e.g. coffee)" />
      <Form.TextField
        id="duration"
        title="Duration (minutes)"
        placeholder="How long? (leave empty for no expiration)"
      />
    </Form>
  );
}

export default withSlackClient(SetStatus);
