import { Form, ActionPanel, Action, showToast, Toast, List, Icon, useNavigation, showHUD } from "@raycast/api";
import { useState, useEffect } from "react";
import { getSlackWebClient } from "./shared/client/WebClient";
import { withSlackClient } from "./shared/withSlackClient";
import { DEFAULT_PRESETS } from "./utils/status-presets";
import { SlackStatusPreset, SlackClient } from "./shared/client";
import { getEmojiForCode } from "./utils/status-emojis";
import { formatRelative } from "date-fns";
import { showFailureToast } from "@raycast/utils";

interface FormValues {
  text: string;
  emoji: string;
  duration: string;
}

function SetStatusForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { pop } = useNavigation();

  async function handleSubmit(values: FormValues) {
    try {
      setIsLoading(true);
      const client = getSlackWebClient();

      const duration = values.duration ? parseInt(values.duration) * 60 : undefined;

      await client.users.profile.set({
        profile: {
          status_text: values.text,
          status_emoji: values.emoji ? `:${values.emoji.replace(/:/g, "")}:` : "",
          status_expiration: duration ? Math.floor(Date.now() / 1000) + duration : 0,
        },
      });

      await showHUD(
        values.text
          ? `Status updated: ${values.text} ${duration ? `for ${duration} minute(s)` : ""}`
          : "Status cleared",
      );
      pop();
    } catch (error) {
      await showFailureToast(String(error));
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

function SetStatus() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<{ text?: string; emoji?: string; expiration?: number }>();

  useEffect(() => {
    async function fetchCurrentStatus() {
      try {
        // First get the current user's ID
        const { id: userId } = await SlackClient.getMe();
        const client = getSlackWebClient();
        const response = await client.users.profile.get({ user: userId });
        if (response.profile) {
          setCurrentStatus({
            text: response.profile.status_text || undefined,
            emoji: response.profile.status_emoji || undefined,
            expiration: response.profile.status_expiration || undefined,
          });
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCurrentStatus();
  }, []);

  async function handlePresetSelect(preset: SlackStatusPreset) {
    try {
      setIsLoading(true);
      const client = getSlackWebClient();

      const duration = preset.defaultDuration * 60; // Convert minutes to seconds
      const expiration = duration > 0 ? Math.floor(Date.now() / 1000) + duration : 0;

      await client.users.profile.set({
        profile: {
          status_text: preset.title,
          status_emoji: preset.emojiCode,
          status_expiration: expiration,
        },
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Status updated",
        message: preset.title,
      });
    } catch (error) {
			await showFailureToast(String(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <List isLoading={isLoading}>
      <List.Section title="Current Status">
        <List.Item
          icon={currentStatus?.emoji ? getEmojiForCode(currentStatus.emoji.replace(/:/g, "")) : Icon.Bubble}
          title={currentStatus?.text || "No Status Set"}
          subtitle={
            currentStatus?.expiration
              ? `Until ${formatRelative(new Date(currentStatus.expiration * 1000), new Date())}`
              : undefined
          }
          actions={
            <ActionPanel>
              <Action title="Set Custom Status" onAction={() => push(<SetStatusForm />)} />
              {currentStatus?.text && (
                <Action
                  title="Clear Status"
                  onAction={async () => {
                    try {
                      setIsLoading(true);
                      const client = getSlackWebClient();
                      await client.users.profile.set({
                        profile: {
                          status_text: "",
                          status_emoji: "",
                          status_expiration: 0,
                        },
                      });
                      setCurrentStatus(undefined);
                      await showToast({
                        style: Toast.Style.Success,
                        title: "Status cleared",
                      });
                    } catch (error) {
											await showFailureToast(String(error));
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                />
              )}
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Presets">
        {DEFAULT_PRESETS.map((preset) => (
          <List.Item
            key={preset.id}
            icon={getEmojiForCode(preset.emojiCode)}
            title={preset.title}
            subtitle={preset.defaultDuration > 0 ? `${preset.defaultDuration}m` : "No expiration"}
            accessories={[...(preset.pauseNotifications ? [{ icon: Icon.BellDisabled }] : [])]}
            actions={
              <ActionPanel>
                <Action title="Set Status" onAction={() => handlePresetSelect(preset)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

export default withSlackClient(SetStatus);
