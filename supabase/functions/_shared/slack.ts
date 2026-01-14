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
