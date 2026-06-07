import { useState } from "react";
import { ActionPanel, Action, Icon, Grid, Color, Detail, Keyboard } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { Design, SearchResponse } from "./types";
import { buildSearchUrl, buildModelUrl, buildCreatorUrl, formatCount, PAGE_SIZE } from "./api";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [columns, setColumns] = useState(5);

  const { isLoading, data, pagination } = useFetch((options) => buildSearchUrl(searchText, options.page), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Referer: "https://makerworld.com/",
    },
    keepPreviousData: true,
    execute: searchText.length > 0,
    mapResult(result: SearchResponse) {
      const filtered = result.hits.filter((d) => !d.nsfw);
      return {
        data: filtered,
        hasMore: result.hits.length === PAGE_SIZE,
      };
    },
  });

  return (
    <Grid
      columns={columns}
      inset={Grid.Inset.Large}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search MakerWorld 3D models..."
      throttle
      pagination={pagination}
      searchBarAccessory={
        <Grid.Dropdown tooltip="Grid Item Size" storeValue onChange={(newValue) => setColumns(parseInt(newValue))}>
          <Grid.Dropdown.Item title="Large" value="3" />
          <Grid.Dropdown.Item title="Medium" value="5" />
          <Grid.Dropdown.Item title="Small" value="8" />
        </Grid.Dropdown>
      }
    >
      {searchText.length === 0 ? (
        <Grid.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Search MakerWorld"
          description="Type keywords to find 3D models"
        />
      ) : data && data.length === 0 && !isLoading ? (
        <Grid.EmptyView icon={Icon.XMarkCircle} title="No Models Found" description="Try different keywords" />
      ) : (
        data?.map((design) => (
          <Grid.Item
            key={design.id}
            content={design.cover}
            title={design.title}
            subtitle={design.designCreator.name}
            keywords={design.tags}
            actions={
              <ActionPanel>
                <Action.Push title="View Details" icon={Icon.Eye} target={<ModelDetail design={design} />} />
                <Action.OpenInBrowser title="Open in Browser" url={buildModelUrl(design)} />
                <Action.CopyToClipboard
                  title="Copy URL"
                  content={buildModelUrl(design)}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </Grid>
  );
}

function ModelDetail({ design }: { design: Design }) {
  const markdown = `![${design.title}](${design.cover})`;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={design.title}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Creator" text={design.designCreator.name} icon={design.designCreator.avatar} />
          <Detail.Metadata.Link
            title="Profile"
            target={buildCreatorUrl(design.designCreator.handle)}
            text={`@${design.designCreator.handle}`}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Likes" text={formatCount(design.likeCount)} icon={Icon.Heart} />
          <Detail.Metadata.Label title="Downloads" text={formatCount(design.downloadCount)} icon={Icon.Download} />
          <Detail.Metadata.Label title="Prints" text={formatCount(design.printCount)} icon={Icon.Hammer} />
          <Detail.Metadata.Label title="Comments" text={formatCount(design.commentCount)} icon={Icon.Bubble} />
          <Detail.Metadata.Label title="Collections" text={formatCount(design.collectionCount)} icon={Icon.Bookmark} />
          <Detail.Metadata.Separator />
          {design.tags.length > 0 && (
            <Detail.Metadata.TagList title="Tags">
              {design.tags.slice(0, 8).map((tag) => (
                <Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.Label title="License" text={design.license} />
          <Detail.Metadata.Label title="Created" text={new Date(design.createTime).toLocaleDateString()} />
          {design.isStaffPicked && (
            <Detail.Metadata.TagList title="Badges">
              <Detail.Metadata.TagList.Item text="Staff Pick" color={Color.Yellow} />
            </Detail.Metadata.TagList>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={buildModelUrl(design)} />
          <Action.CopyToClipboard
            title="Copy URL"
            content={buildModelUrl(design)}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
        </ActionPanel>
      }
    />
  );
}
