import { Action, ActionPanel, Clipboard, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useState } from "react";

import { webUrls } from "./api/url";
import { AppendDocForm } from "./components/AppendDocForm";
import { DocForm } from "./components/DocForm";
import { Guard } from "./components/Guard";
import { useDocs, type DocEntry } from "./hooks/useDocs";
import { useQuery } from "./hooks/useQuery";
import type { Orbit } from "./hooks/useOrbit";
import { absoluteDocLinks } from "./lib/docs";
import { showError } from "./lib/errors";
import { escapeMarkdown } from "./lib/markdown";
import { formatDate } from "./lib/presentation";

export default function Command() {
  return <Guard scope="docs:read">{(orbit) => <SearchDocs orbit={orbit} />}</Guard>;
}

function SearchDocs({ orbit }: { orbit: Orbit }) {
  const { privateDocs, sharedDocs, isLoading, revalidate } = useDocs(orbit);
  const [showDetail, setShowDetail] = useCachedState("search-docs.detail", true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useQuery(["doc", orbit.cacheScope, selectedId ?? ""], () => orbit.client.getDoc(selectedId!), {
    execute: showDetail && Boolean(selectedId),
    keepPreviousData: false,
    onError: () => undefined,
  });
  const selectedMarkdown =
    selected.data && selected.data.id === selectedId
      ? absoluteDocLinks(selected.data.markdown, orbit.client.base, orbit.workspaceId)
      : undefined;

  const item = (entry: DocEntry) => {
    const { doc } = entry;
    const url = webUrls.doc(orbit.client.base, orbit.workspaceId, doc.id);
    return (
      <List.Item
        key={doc.id}
        id={doc.id}
        icon={doc.icon ? doc.icon : Icon.Document}
        title={entry.title}
        subtitle={showDetail ? undefined : entry.path}
        keywords={entry.path ? entry.path.split(" › ") : undefined}
        accessories={showDetail ? undefined : [{ date: new Date(doc.updated_at), tooltip: "Updated" }]}
        detail={
          <List.Item.Detail
            isLoading={doc.id === selectedId && selected.isLoading}
            markdown={
              doc.id === selectedId && selected.error
                ? `_Could not load the doc: ${selected.error.message}_`
                : doc.id === selectedId && selectedMarkdown !== undefined
                  ? `# ${escapeMarkdown(entry.title)}\n\n${selectedMarkdown}`
                  : `# ${escapeMarkdown(entry.title)}`
            }
            metadata={
              <List.Item.Detail.Metadata>
                {entry.path && <List.Item.Detail.Metadata.Label title="In" text={entry.path} />}
                <List.Item.Detail.Metadata.Label title="Space" text={doc.private ? "Private" : "Shared"} />
                <List.Item.Detail.Metadata.Label title="Updated" text={formatDate(doc.updated_at)} />
                <List.Item.Detail.Metadata.Link title="Orbit" text="Open in Orbit" target={url} />
              </List.Item.Detail.Metadata>
            }
          />
        }
        actions={
          <ActionPanel title={entry.title}>
            <ActionPanel.Section>
              <Action.OpenInBrowser title="Open in Orbit" url={url} />
              <Action
                title={showDetail ? "Hide Details" : "Show Details"}
                icon={Icon.Sidebar}
                shortcut={{ modifiers: ["cmd"], key: "d" }}
                onAction={() => setShowDetail(!showDetail)}
              />
              {orbit.hasScope("docs:write") && (
                <Action.Push
                  title="Add to Doc"
                  icon={Icon.Plus}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                  target={<AppendDocForm orbit={orbit} doc={doc} onDone={() => selected.revalidate()} />}
                />
              )}
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.CopyToClipboard title="Copy Link" content={url} shortcut={Keyboard.Shortcut.Common.Copy} />
              <Action
                title="Copy Markdown"
                icon={Icon.Clipboard}
                shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
                onAction={async () => {
                  try {
                    const full = await orbit.client.getDoc(doc.id);
                    await Clipboard.copy(absoluteDocLinks(full.markdown, orbit.client.base, orbit.workspaceId));
                    await showToast({ style: Toast.Style.Success, title: "Copied Markdown" });
                  } catch (error) {
                    await showError(error, "Could not copy the doc");
                  }
                }}
              />
              <Action.CopyToClipboard
                title="Copy Title"
                content={entry.title}
                shortcut={Keyboard.Shortcut.Common.Pin}
              />
            </ActionPanel.Section>
            <ActionPanel.Section>
              {orbit.hasScope("docs:write") && (
                <Action.Push
                  title="Create Doc"
                  icon={Icon.NewDocument}
                  shortcut={Keyboard.Shortcut.Common.New}
                  target={<DocForm orbit={orbit} onCreated={() => revalidate()} />}
                />
              )}
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={() => {
                  revalidate();
                  if (selectedId) selected.revalidate();
                }}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showDetail && privateDocs.length + sharedDocs.length > 0}
      searchBarPlaceholder="Search docs by title"
      onSelectionChange={setSelectedId}
    >
      <List.EmptyView icon={Icon.Document} title="No docs" />
      <List.Section title="Shared" subtitle={String(sharedDocs.length)}>
        {sharedDocs.map(item)}
      </List.Section>
      <List.Section title="Private" subtitle={String(privateDocs.length)}>
        {privateDocs.map(item)}
      </List.Section>
    </List>
  );
}
