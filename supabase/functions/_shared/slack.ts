/**
 * Shared utility for sending Slack webhook notifications
 */

// Slack Block Kit types
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
}

type HeaderBlock = {
  type: "header";
  text: { type: string; text: string; emoji: boolean };
};
type SectionBlock = {
  type: "section";
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
};
type DividerBlock = { type: "divider" };
type AnyBlock = HeaderBlock | SectionBlock | DividerBlock;

export interface SlackBlockMessage {
  blocks: SlackBlock[];
}

/**
 * Send notification to Slack webhook using Block Kit for rich formatting
 * @param message - The main message text (or Block Kit blocks)
 * @param isError - Whether this is an error notification (changes color)
 */
export async function sendSlackNotification(
  message: string | SlackBlockMessage,
  isError: boolean = false
): Promise<void> {
  try {
    // Read SLACK_WEBHOOK_URL from environment variables
    const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    
    if (!webhookUrl) {
      console.warn("SLACK_WEBHOOK_URL not configured, skipping Slack notification");
      return;
    }

    // Support both simple text messages and Block Kit formatted messages
    const payload = typeof message === "string" ? {
      text: message,
      attachments: isError ? [
        {
          color: "danger",
          text: "⚠️ Error notification",
        }
      ] : [
        {
          color: "good",
          text: "✅ Notification",
        }
      ],
    } : message;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Slack notification failed: ${response.status} ${response.statusText}. Response: ${responseText}`);
    } else {
      console.log("Slack notification sent successfully");
    }
  } catch (error) {
    // Defensive error handling: Log the error but don't crash the scraper
    console.error("Failed to send Slack notification (non-critical error):", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create a rich Block Kit notification for scraper results
 * 
 * @param params.municipality - Optional: Name of the municipality processed
 * @param params.newSourcesFound - Optional: Number of new sources discovered
 * @param params.eventsScraped - Number of events successfully scraped
 * @param params.eventsInserted - Number of events inserted into database
 * @param params.eventsDuplicate - Number of duplicate events skipped
 * @param params.eventsFailed - Number of events that failed to process
 * @param params.totalSources - Total number of sources processed
 * @returns Block Kit formatted message object with type-safe blocks
 */
export function createScraperBlockNotification(params: {
  municipality?: string;
  newSourcesFound?: number;
  eventsScraped: number;
  eventsInserted: number;
  eventsDuplicate: number;
  eventsFailed: number;
  totalSources: number;
}): SlackBlockMessage {
  const { 
    municipality, 
    newSourcesFound, 
    eventsScraped, 
    eventsInserted, 
    eventsDuplicate, 
    eventsFailed,
    totalSources 
  } = params;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "✅ Scraper Run Completed",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Sources Processed:*\n${totalSources}`,
        },
        {
          type: "mrkdwn",
          text: `*Events Scraped:*\n${eventsScraped}`,
        },
        {
          type: "mrkdwn",
          text: `*Events Inserted:*\n✅ ${eventsInserted}`,
        },
        {
          type: "mrkdwn",
          text: `*Duplicates Skipped:*\n⏭️ ${eventsDuplicate}`,
        },
      ],
    },
  ];

  // Add municipality info if provided
  if (municipality) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🏛️ Municipality Processed:*\n${municipality}`,
      },
    });
  }

  // Add new sources info if provided
  if (newSourcesFound !== undefined && newSourcesFound > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🆕 New Sources Found:*\n${newSourcesFound} new source${newSourcesFound !== 1 ? 's' : ''} discovered`,
      },
    });
  }

  // Add failure info if there were failures
  if (eventsFailed > 0) {
    blocks.push({
      type: "divider",
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*⚠️ Failures:*\n${eventsFailed} event${eventsFailed !== 1 ? 's' : ''} failed to process`,
      },
    });
  }

  return { blocks };
}
