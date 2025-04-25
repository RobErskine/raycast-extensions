import { Form, ActionPanel, Action, showToast, Toast, List, Icon, useNavigation, Image } from "@raycast/api";
import { useState, useEffect } from "react";
import { getSlackWebClient } from "./shared/client/WebClient";
import { withSlackClient } from "./shared/withSlackClient";
import { DEFAULT_PRESETS, usePresets } from "./utils/status-presets";
import { nanoid } from "nanoid";
import { SlackStatusPreset, SlackClient } from "./shared/client";
import { getEmojiForCode, slackEmojiCodeMap } from "./utils/status-emojis";
import { formatRelative } from "date-fns";
import { showFailureToast, useCachedPromise } from "@raycast/utils";

// Extended preset interface to include custom emoji URL
interface ExtendedSlackStatusPreset extends SlackStatusPreset {
  customEmojiUrl?: string;
}

interface FormValues {
  text: string;
  emoji: string;
  duration: string;
  pauseNotifications: boolean;
}

interface SetStatusFormProps {
  onStatusUpdate: (status: { text?: string; emoji?: string; expiration?: number }) => void;
  initialValues?: {
    text?: string;
    emoji?: string;
    duration?: string;
    pauseNotifications?: boolean;
  };
}

// Helper function to get the appropriate icon for the status
function getStatusIcon(emojiCode?: string, workspaceEmojis?: Record<string, string>) {
  if (!emojiCode) return Icon.Bubble;
  
  // Ensure the emoji code has colons for standard emoji lookup
  const formattedEmojiCode = emojiCode.startsWith(':') && emojiCode.endsWith(':') 
    ? emojiCode 
    : `:${emojiCode.replace(/:/g, "")}:`;
  
  // Try to get standard emoji first
  const standardEmoji = getEmojiForCode(formattedEmojiCode);
  if (standardEmoji) return standardEmoji;
  
  // Remove colons from emoji code for custom workspace emoji lookup
  const cleanCode = emojiCode.replace(/:/g, "");
  
  // Check if it's a custom workspace emoji
  if (workspaceEmojis && workspaceEmojis[cleanCode]) {
    const url = workspaceEmojis[cleanCode];
    // Only use URL if it's a direct image URL
    if (typeof url === 'string' && url.startsWith('http')) {
      return url;
    }
  }
  
  // Fall back to default icon
  return Icon.Bubble;
}

function SetStatusForm({ onStatusUpdate, initialValues }: SetStatusFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { pop } = useNavigation();
  const { addPreset } = usePresets();
  
  // Get common emojis from the slackEmojiCodeMap
  const commonEmojis = Object.entries(slackEmojiCodeMap)
    //.slice(0, 50) // Limit to first 50 emojis to avoid overwhelming the dropdown
    .map(([code, emoji]) => ({
      name: code.replace(/:/g, ""),
      title: `${code} ${emoji}`,
      emoji: emoji
    }));
  
  // Fetch emojis from Slack API
  const { data: emojiData, isLoading: isLoadingEmojis } = useCachedPromise(async () => {
    const slackWebClient = getSlackWebClient();
    return await slackWebClient.emoji.list();
  }, []);

  async function handleSubmit(values: FormValues) {
    try {
      setIsLoading(true);
      const client = getSlackWebClient();

      const duration = values.duration ? parseInt(values.duration) * 60 : undefined;
      const expiration = duration ? Math.floor(Date.now() / 1000) + duration : 0;

      // Set the status first
      await client.users.profile.set({
        profile: {
          status_text: values.text,
          status_emoji: values.emoji ? `:${values.emoji.replace(/:/g, "")}:` : "",
          status_expiration: expiration,
        },
      });

      // Set do not disturb if requested
      if (values.pauseNotifications && duration) {
        await client.dnd.setSnooze({ num_minutes: Math.ceil(duration / 60) });
      }

      // Update parent's status immediately
      onStatusUpdate({
        text: values.text,
        emoji: values.emoji ? `:${values.emoji.replace(/:/g, "")}:` : undefined,
        expiration: expiration || undefined,
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Status updated",
        message: values.text || "Status cleared",
      });
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
          <Action.SubmitForm
            title="Save as Preset"
            onSubmit={async (values: FormValues) => {
              // Get the emoji code and check if it's a custom emoji
              const emojiName = values.emoji ? values.emoji.replace(/:/g, "") : "speech_balloon";
              const emojiCode = `:${emojiName}:`;
              
              // Check if this is a custom emoji from the workspace
              let customEmojiUrl: string | undefined;
              if (emojiData?.emoji && emojiName in emojiData.emoji) {
                const url = emojiData.emoji[emojiName];
                if (typeof url === 'string' && url.startsWith('http')) {
                  customEmojiUrl = url;
                }
              }
              
              const preset: ExtendedSlackStatusPreset = {
                id: nanoid(),
                title: values.text || "Custom Status",
                emojiCode: emojiCode,
                defaultDuration: values.duration ? parseInt(values.duration) : 0,
                pauseNotifications: values.pauseNotifications,
                customEmojiUrl: customEmojiUrl,
              };
              
              await addPreset(preset);
              await showToast({
                style: Toast.Style.Success,
                title: "Preset saved",
              });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField 
        id="text" 
        title="Status Text" 
        placeholder="What's happening? (leave empty to clear)" 
        defaultValue={initialValues?.text}
      />
      <Form.Dropdown 
        id="emoji" 
        title="Emoji" 
        isLoading={isLoadingEmojis}
        defaultValue={initialValues?.emoji}
      >
        <Form.Dropdown.Item key="empty" value="" title="No emoji" />
        
        {/* Common Unicode Emojis Section */}
        <Form.Dropdown.Section title="Common Emojis">
          {commonEmojis.map(item => (
            <Form.Dropdown.Item 
              key={`common-${item.name}`} 
              value={item.name} 
              title={`${item.name}`}
              icon={{ source: item.emoji }}
            />
          ))}
        </Form.Dropdown.Section>
        
        {/* Workspace Emojis Section */}
        <Form.Dropdown.Section title="Workspace Emojis">
          {emojiData?.emoji && Object.entries(emojiData.emoji).map(([name, url]) => (
            <Form.Dropdown.Item 
              key={name} 
              value={name} 
              title={`${name}`} 
              icon={typeof url === 'string' && url.startsWith('http') ? url : undefined} 
            />
          ))}
        </Form.Dropdown.Section>
      </Form.Dropdown>
      <Form.TextField
        id="duration"
        title="Duration (minutes)"
        placeholder="How long? (leave empty for no expiration)"
        defaultValue={initialValues?.duration}
      />
      <Form.Checkbox 
        id="pauseNotifications" 
        label="Pause notifications" 
        title="Do Not Disturb" 
        defaultValue={initialValues?.pauseNotifications}
      />
    </Form>
  );
}

// Helper component to render a status preset item
function StatusPresetItem({
  preset,
  icon,
  showDeleteAction = false,
  onPresetSelect,
  onPresetDelete,
  onCustomDuration,
}: {
  preset: SlackStatusPreset;
  icon: string | Image.ImageLike;
  showDeleteAction?: boolean;
  onPresetSelect: (preset: SlackStatusPreset) => void;
  onPresetDelete?: (presetId: string) => Promise<void>;
  onCustomDuration?: (preset: SlackStatusPreset) => void;
}) {
  return (
    <List.Item
      key={preset.id}
      icon={icon}
      title={preset.title}
      subtitle={preset.defaultDuration > 0 ? `${preset.defaultDuration}m` : "No expiration"}
      accessories={[...(preset.pauseNotifications ? [{ icon: Icon.BellDisabled }] : [])]}
      actions={
        <ActionPanel>
          <Action title="Set Status" onAction={() => onPresetSelect(preset)} />
          {onCustomDuration && (
            <Action
              title="Set with Custom Duration"
              onAction={() => onCustomDuration(preset)}
            />
          )}
          {showDeleteAction && preset.id && onPresetDelete && (
            <Action
              title="Delete Preset"
              style={Action.Style.Destructive}
              onAction={async () => {
                await onPresetDelete(preset.id!);
                await showToast({
                  style: Toast.Style.Success,
                  title: "Preset deleted",
                });
              }}
            />
          )}
        </ActionPanel>
      }
    />
  );
}

function SetStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<{ text?: string; emoji?: string; expiration?: number }>();
  const { push } = useNavigation();
  const { customPresets, deletePreset, refreshPresets } = usePresets();
  
  // Fetch emojis from Slack API to get custom emoji URLs
  const { data: emojiData } = useCachedPromise(async () => {
    const slackWebClient = getSlackWebClient();
    return await slackWebClient.emoji.list();
  }, []);

  useEffect(() => {
    async function initialize() {
      await Promise.all([refreshPresets(), fetchCurrentStatus()]);
    }

    async function fetchCurrentStatus() {
      try {
        setIsLoading(true);
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

    initialize();
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

  async function handleCustomDuration(preset: SlackStatusPreset) {
    // Extract emoji name from the emoji code (remove colons)
    const emojiName = preset.emojiCode ? preset.emojiCode.replace(/:/g, "") : "";
    console.log(emojiName);
    
    push(
      <SetStatusForm
        onStatusUpdate={setCurrentStatus}
        initialValues={{
          text: preset.title,
          emoji: emojiName,
          // Leave duration empty for customization
          pauseNotifications: preset.pauseNotifications,
        }}
      />
    );
  }

  return (
    <List isLoading={isLoading}>
      <List.Section title="Current Status">
        <List.Item
          icon={getStatusIcon(currentStatus?.emoji, emojiData?.emoji)}
          title={currentStatus?.text || "No Status Set"}
          subtitle={
            currentStatus?.expiration
              ? `Until ${formatRelative(new Date(currentStatus.expiration * 1000), new Date())}`
              : undefined
          }
          actions={
            <ActionPanel>
              <Action
                title="Set Custom Status"
                onAction={() => push(<SetStatusForm onStatusUpdate={setCurrentStatus} />)}
              />
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

      {customPresets.length > 0 && (
        <List.Section title="My Presets">
          {customPresets.map((preset) => {
            // Check if this is an extended preset with a custom emoji URL
            const extendedPreset = preset as ExtendedSlackStatusPreset;
            const customEmojiUrl = extendedPreset.customEmojiUrl;
            
            // Use custom URL if available, otherwise use standard emoji
            const presetIcon = customEmojiUrl || getEmojiForCode(preset.emojiCode.replace(/:/g, ""));
            
            return (
              <StatusPresetItem
                key={preset.id}
                preset={preset}
                icon={presetIcon}
                showDeleteAction={true}
                onPresetSelect={handlePresetSelect}
                onPresetDelete={async (presetId) => {
                  await deletePreset(presetId);
                }}
                onCustomDuration={handleCustomDuration}
              />
            );
          })}
        </List.Section>
      )}

      <List.Section title="Default Presets">
        {DEFAULT_PRESETS.map((preset) => (
          <StatusPresetItem
            key={preset.id}
            preset={preset}
            icon={getEmojiForCode(preset.emojiCode.replace(/:/g, ""))}
            onPresetSelect={handlePresetSelect}
            onCustomDuration={handleCustomDuration}
          />
        ))}
      </List.Section>
    </List>
  );
}

export default withSlackClient(SetStatus);
