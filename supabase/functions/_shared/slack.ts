/**
 * Shared utility for sending Slack webhook notifications
 */

/**
 * Send notification to Slack webhook using Block Kit for rich formatting
 * @param message - The main message text (or Block Kit blocks)
 * @param isError - Whether this is an error notification (changes color)
 */
export async function sendSlackNotification(
  message: string | { blocks: unknown[] },
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
          text: "⚠️ Error occurred during scraping",
        }
      ] : [
        {
          color: "good",
          text: "✅ Scraping completed successfully",
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
 * @param municipality - Name of the municipality processed
 * @param newSourcesFound - Number of new sources found
 * @param eventsScraped - Number of events successfully scraped
 * @param eventsInserted - Number of events inserted into database
 * @param eventsDuplicate - Number of duplicate events skipped
 * @param eventsFailed - Number of events that failed to process
 * @param totalSources - Total number of sources processed
 * @returns Block Kit formatted message object
 */
export function createScraperBlockNotification(params: {
  municipality?: string;
  newSourcesFound?: number;
  eventsScraped: number;
  eventsInserted: number;
  eventsDuplicate: number;
  eventsFailed: number;
  totalSources: number;
}): { blocks: unknown[] } {
  const { 
    municipality, 
    newSourcesFound, 
    eventsScraped, 
    eventsInserted, 
    eventsDuplicate, 
    eventsFailed,
    totalSources 
  } = params;

  const blocks = [
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
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*⚠️ Failures:*\n${eventsFailed} event${eventsFailed !== 1 ? 's' : ''} failed to process`,
        },
      }
    );
  }

  return { blocks };
}
