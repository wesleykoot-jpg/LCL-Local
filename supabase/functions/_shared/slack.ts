/**
 * Shared utility for sending Slack webhook notifications
 */

/**
 * Send notification to Slack webhook
 * @param webhookUrl - The Slack webhook URL
 * @param message - The main message text
 * @param isError - Whether this is an error notification (changes color)
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: string,
  isError: boolean = false
): Promise<void> {
  try {
    const payload = {
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
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
  }
}
