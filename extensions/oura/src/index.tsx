import { List, openExtensionPreferences, Action, ActionPanel, Icon } from "@raycast/api";
import { oura } from "./utils/ouraData";
import { convertHeight, convertWeight } from "./utils/measurement";
import Unauthorized from "./unauthorized";

interface UserResponse {
  isLoading: boolean;
  error: Error;
  data: {
    id: string;
    age: number;
    weight: number;
    height: number;
    biological_sex: string;
    email: string;
  };
}

interface RingBatteryResponse {
  isLoading: boolean;
  error: Error;
  data: {
    data: [{ timestamp: string; level: number; in_charger: boolean }];
  };
}

export default function Command() {
  const personalInfo = oura("usercollection/personal_info") as UserResponse;
  const battery = oura("usercollection/ring_battery_level?latest=true") as RingBatteryResponse;

  // Only personal_info gates the Unauthorized screen. The battery endpoint requires the
  // `ring_configuration` scope, which users authorized before this change won't have granted —
  // so we degrade gracefully on the battery row instead of blocking the whole command.
  if (personalInfo.error) {
    return <Unauthorized />;
  }

  const batteryReading = battery?.data?.data?.[0];
  let batterySubtitle: string;
  if (battery.isLoading) {
    batterySubtitle = "Loading…";
  } else if (battery.error || !batteryReading) {
    batterySubtitle = "Unavailable — reconnect your Oura account to enable";
  } else {
    batterySubtitle = `${batteryReading.level}%${batteryReading.in_charger ? " · Charging" : ""}`;
  }

  return (
    <List isLoading={personalInfo.isLoading || battery.isLoading}>
      <List.Item title={`Age`} subtitle={`${personalInfo?.data?.age}`} />
      <List.Item
        title={`Weight`}
        subtitle={`${convertWeight(personalInfo?.data?.weight)}`}
        actions={
          <ActionPanel>
            <Action title="Change Unit of Measurement" onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
      <List.Item
        title={`Height`}
        subtitle={`${convertHeight(personalInfo?.data?.height)}`}
        actions={
          <ActionPanel>
            <Action title="Change Unit of Measurement" onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
      <List.Item title={`Email`} subtitle={`${personalInfo?.data?.email}`} />
      <List.Item
        title={`Battery`}
        subtitle={batterySubtitle}
        icon={batteryReading?.in_charger ? Icon.BatteryCharging : Icon.Battery}
      />
    </List>
  );
}
