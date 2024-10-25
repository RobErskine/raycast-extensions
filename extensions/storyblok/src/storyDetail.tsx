import { Detail, Action, ActionPanel, getPreferenceValues } from "@raycast/api";
import { sbData } from "./utils/storyblokData";
import { storyDetail } from "./utils/types";

const preferences = getPreferenceValues<Preferences>();

type story = {
  story: storyDetail;
};

const storyJson = function (version: string, slug: string) {
  return `${preferences.apiLocation}/v2/cdn/stories/${slug}?version=${version}&token=${preferences.accessToken}`;
};

export default function StoryDetail(props: { spaceId: number; storyId: number }) {
  const data = sbData<story>(`spaces/${props.spaceId}/stories/${props.storyId}`);

  if (data.isLoading) {
    return <Detail markdown={`Loading Story data...`} />;
  } else {
    return (
      <Detail
        markdown={`\`\`\`json\n${JSON.stringify(data.data?.story, null, 4)}`}
        actions={
          <ActionPanel>
            {(data.data?.story.slug && data.data?.story.published_at) && (
              <>
                {/* <Action.OpenInBrowser title="Open Draft JSON" url={storyJson("draft", data.data.story.slug)} /> */}
                <Action.OpenInBrowser title="Open Published JSON" url={storyJson("published", data.data.story.slug)} />
              </>
            )}
          </ActionPanel>
        }
      />
    );
  }
}
