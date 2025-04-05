import { environment } from "@raycast/api";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { useEffect, useState } from "react";
import { SlackStatusPreset } from "../shared/client";
import { nanoid } from "nanoid";

export const DEFAULT_PRESETS: SlackStatusPreset[] = [
  {
    title: "Focus Mode",
    emojiCode: ":technologist:",
    defaultDuration: 120,
    pauseNotifications: true,
    id: nanoid(),
  },
  {
    title: "In a Meeting",
    emojiCode: ":spiral_calendar_pad:",
    defaultDuration: 30,
    pauseNotifications: false,
    id: nanoid(),
  },
  {
    title: "Eating",
    emojiCode: ":hamburger:",
    defaultDuration: 60,
    pauseNotifications: false,
    id: nanoid(),
  },
  {
    title: "Coffee Break",
    emojiCode: ":coffee:",
    defaultDuration: 15,
    pauseNotifications: false,
    id: nanoid(),
  },
  {
    title: "AFK",
    emojiCode: ":walking:",
    defaultDuration: 0,
    pauseNotifications: false,
    id: nanoid(),
  },
];

export function storePresets(presets: SlackStatusPreset[]) {
  try {
    mkdirSync(`${environment.supportPath}`, { recursive: true });
    const path = `${environment.supportPath}/presets.json`;
    writeFileSync(path, JSON.stringify(presets));
  } catch (e) {
    console.error(e);
  }
}

function readStoredPresets(): SlackStatusPreset[] | undefined {
  try {
    const path = `${environment.supportPath}/presets.json`;
    const contents = readFileSync(path);
    const serializedValue = contents.toString();
    return JSON.parse(serializedValue) as SlackStatusPreset[];
  } catch (e) {
    return undefined;
  }
}

interface UsePresetsReturn {
  customPresets: SlackStatusPreset[];
  addPreset: (preset: SlackStatusPreset) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  refreshPresets: () => Promise<void>;
}

export function usePresets(): UsePresetsReturn {
  const [presets, setPresets] = useState<SlackStatusPreset[]>(() => {
    return readStoredPresets() || [];
  });

  const refreshPresets = async () => {
    const stored = readStoredPresets();
    if (stored) {
      setPresets(stored);
    }
  };

  useEffect(() => {
    storePresets(presets);
  }, [presets]);

  const addPreset = async (preset: SlackStatusPreset) => {
    const newPresets = [...presets, preset];
    await storePresets(newPresets);
    setPresets(newPresets);
  };

  const deletePreset = async (presetId: string) => {
    const updatedPresets = presets.filter((p) => p.id !== presetId);
    await storePresets(updatedPresets);
    setPresets(updatedPresets);
  };

  return {
    customPresets: presets,
    addPreset,
    deletePreset,
    refreshPresets,
  };
}
