import { useState, useMemo } from "react";
import { ActionPanel, Action, Grid, getPreferenceValues } from "@raycast/api";
import iconsData from "./icons-data.json";

interface BootstrapIcon {
  name: string;
  svgContent: string;
}

interface Preferences {
  preferredCopyMethod: "iconName" | "embeddedSvg" | "sprite" | "externalImage" | "iconFont";
}

function getSvgDataUri(svgContent: string): string {
  const encodedSvg = encodeURIComponent(svgContent);
  return `data:image/svg+xml,${encodedSvg}`;
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const preferences = getPreferenceValues<Preferences>();

  const icons = iconsData as BootstrapIcon[];

  const filteredIcons = useMemo(() => {
    if (!searchText) return icons;
    const query = searchText.toLowerCase();
    return icons.filter((icon) => icon.name.toLowerCase().includes(query));
  }, [icons, searchText]);

  return (
    <Grid
      columns={6}
      inset={Grid.Inset.Large}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Bootstrap Icons..."
      throttle
    >
      {filteredIcons.map((icon) => {
        const svgDataUri = getSvgDataUri(icon.svgContent);
        const spriteExample = `<svg class="bi" width="32" height="32" fill="currentColor">
          <use xlink:href="bootstrap-icons.svg#${icon.name}"/>
        </svg>`;
        const externalImageExample = `<img src="/assets/icons/${icon.name}.svg" alt="${icon.name}" width="32" height="32">`;
        const iconFontExample = `<i class="bi bi-${icon.name}"></i>`;

        // Define all actions with their identifiers
        const allActions = {
          iconName: (
            <Action.CopyToClipboard
              key="iconName"
              title="Copy as Icon Name"
              content={icon.name}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          ),
          embeddedSvg: (
            <Action.CopyToClipboard
              key="embeddedSvg"
              title="Copy as Embedded SVG"
              content={icon.svgContent}
              shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
            />
          ),
          sprite: (
            <Action.CopyToClipboard
              key="sprite"
              title="Copy as Sprite"
              content={spriteExample}
              shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
            />
          ),
          externalImage: (
            <Action.CopyToClipboard
              key="externalImage"
              title="Copy as External Image"
              content={externalImageExample}
              shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
            />
          ),
          iconFont: (
            <Action.CopyToClipboard
              key="iconFont"
              title="Copy as Icon Font"
              content={iconFontExample}
              shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
            />
          ),
        };

        // Reorder actions to put preferred method first
        const orderedActions = [
          allActions[preferences.preferredCopyMethod],
          ...Object.entries(allActions)
            .filter(([key]) => key !== preferences.preferredCopyMethod)
            .map(([, action]) => action),
        ];

        return (
          <Grid.Item
            key={icon.name}
            content={{ value: { source: svgDataUri }, tooltip: icon.name }}
            title={icon.name}
            actions={<ActionPanel>{orderedActions}</ActionPanel>}
          />
        );
      })}
      <Grid.EmptyView
        icon={{ source: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/icons/search.svg" }}
        title="No Icons Found"
        description={`No Bootstrap Icons match "${searchText}"\nTry refining your search query`}
      />
    </Grid>
  );
}
