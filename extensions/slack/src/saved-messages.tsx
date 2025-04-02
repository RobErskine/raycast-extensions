import { Action, ActionPanel, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { formatDistanceToNow } from "date-fns";
import { WebAPICallResult } from "@slack/web-api";

import { withSlackClient } from "./shared/withSlackClient";
import { getSlackWebClient } from "./shared/client/WebClient";
import { convertTimestampToDate, handleError } from "./shared/utils";
import { useChannels } from "./shared/client";

interface StarredItem {
  type: string;
  message?: {
    text: string;
    ts: string;
    team: string;
    user: string;
    permalink: string;
  };
}

interface StarredItemsResponse extends WebAPICallResult {
  items?: StarredItem[];
}

function SavedMessages() {
  const { data: channels } = useChannels();
  const users = channels?.[0];

  const { data, isLoading } = useCachedPromise(
    async () => {
      const webClient = getSlackWebClient();
      
      // Fetch saved items using stars.list endpoint
      const results = await webClient.stars.list({});
      const typedResults = results as StarredItemsResponse;
      return typedResults.items?.filter(item => item.type === 'message') ?? [];
    },
    [],
    {
      onError(error) {
        handleError(error);
      },
    }
  );

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={data && data.length > 0}
    >
      {data?.map((item) => {
        const message = item.message;
        if (!message) return null;

        const user = users?.find((u) => u.id === message.user);
        const timestamp = convertTimestampToDate(message.ts);

        return (
          <List.Item
            key={message.ts}
            title={message.text}
            subtitle={user?.name || "Unknown User"}
            accessories={[
              {
                text: formatDistanceToNow(timestamp, { addSuffix: true }),
              },
            ]}
            detail={
              <List.Item.Detail
                markdown={message.text}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="From" text={user?.name || "Unknown"} />
                    <List.Item.Detail.Metadata.Label title="When" text={formatDistanceToNow(timestamp, { addSuffix: true })} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action.OpenInBrowser
                  title="Open in Slack"
                  url={message.permalink}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

export default withSlackClient(SavedMessages);