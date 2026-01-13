/**
 * Slack alert integration for scraper failures.
 * Posts formatted alerts to SLACK_WEBHOOK_URL with suppression logic.
 */

import axios from 'axios';
import { getConfig } from '../../config/defaults';
import { getScrapeState, getRecentEvents, ScrapeEvent } from '../supabase';

export interface AlertContext {
  source_id: string;
  url: string;
  run_id: string;
  consecutive_failures: number;
  first_failure_at?: string;
  last_failure_at?: string;
  http_statuses: Record<number, number>;
  error_excerpt?: string;
  supabase_url?: string;
}

/**
 * Check if enough time has passed since last alert for this source
 */
export async function shouldSendAlert(
  source_id: string,
  alertSuppressionMs: number
): Promise<boolean> {
  const state = await getScrapeState(source_id);
  
  if (!state?.last_alert_at) {
    return true;
  }
  
  const lastAlertTime = new Date(state.last_alert_at).getTime();
  const now = Date.now();
  
  return (now - lastAlertTime) >= alertSuppressionMs;
}

/**
 * Build alert context from recent events
 */
export async function buildAlertContext(
  source_id: string,
  url: string,
  run_id: string,
  consecutiveFailures: number
): Promise<AlertContext> {
  const recentEvents = await getRecentEvents(source_id, consecutiveFailures);
  
  // Aggregate HTTP statuses
  const httpStatuses: Record<number, number> = {};
  let firstFailureAt: string | undefined;
  let lastFailureAt: string | undefined;
  let errorExcerpt: string | undefined;
  
  for (const event of recentEvents) {
    if (!event.success) {
      if (event.http_status !== null) {
        httpStatuses[event.http_status] = (httpStatuses[event.http_status] || 0) + 1;
      }
      
      if (event.error && !errorExcerpt) {
        errorExcerpt = event.error.substring(0, 200);
      }
      
      if (!lastFailureAt || event.created_at > lastFailureAt) {
        lastFailureAt = event.created_at;
      }
      
      if (!firstFailureAt || event.created_at < firstFailureAt) {
        firstFailureAt = event.created_at;
      }
    }
  }
  
  return {
    source_id,
    url,
    run_id,
    consecutive_failures: consecutiveFailures,
    first_failure_at: firstFailureAt,
    last_failure_at: lastFailureAt,
    http_statuses: httpStatuses,
    error_excerpt: errorExcerpt,
  };
}

/**
 * Determine likely cause and suggestion based on HTTP statuses and errors
 */
function determineCauseAndSuggestion(context: AlertContext): {
  cause: string;
  suggestion: string;
} {
  const statuses = Object.keys(context.http_statuses).map(Number);
  
  // Check for rate limiting
  if (statuses.includes(429)) {
    return {
      cause: 'Repeated HTTP 429 responses, indicating rate limiting by the server.',
      suggestion: 'Reduce request rate, increase backoff delays, respect Retry-After headers, or contact site owner for higher rate limits.',
    };
  }
  
  // Check for server errors
  if (statuses.some(s => s >= 500 && s < 600)) {
    return {
      cause: 'Repeated HTTP 5xx responses, likely server-side failure or rate/automation blocking.',
      suggestion: 'Increase exponential backoff intervals, reduce concurrency, or contact site owner to report issues.',
    };
  }
  
  // Check for client errors
  if (statuses.some(s => s >= 400 && s < 500)) {
    return {
      cause: 'HTTP 4xx responses, possibly blocked, forbidden, or invalid URL.',
      suggestion: 'Verify URL validity, check for IP blocking, ensure proper authentication if required.',
    };
  }
  
  // Check for network/timeout errors
  if (context.error_excerpt?.toLowerCase().includes('timeout') ||
      context.error_excerpt?.toLowerCase().includes('network')) {
    return {
      cause: 'Network timeouts or connection errors, indicating connectivity issues.',
      suggestion: 'Check network connectivity, increase timeout values, or verify target server is accessible.',
    };
  }
  
  // Check for parsing errors
  if (context.error_excerpt?.toLowerCase().includes('parse') ||
      context.error_excerpt?.toLowerCase().includes('schema')) {
    return {
      cause: 'Parsing errors, likely due to schema or structure changes on the target site.',
      suggestion: 'Update parser logic to handle new schema, verify HTML structure changes.',
    };
  }
  
  // Default
  return {
    cause: 'Unknown failure pattern - check error details and response logs.',
    suggestion: 'Review scrape_events table for detailed error messages, check robots.txt compliance, enable conditional GETs with ETag support.',
  };
}

export interface SlackMessagePayload {
  text: string;
  blocks?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
  }>;
}

/**
 * Format Slack message payload
 */
function formatSlackMessage(
  context: AlertContext,
  supabaseProjectUrl?: string
): SlackMessagePayload {
  const { cause, suggestion } = determineCauseAndSuggestion(context);
  
  const statusSummary = Object.entries(context.http_statuses)
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
  
  const supabaseLink = supabaseProjectUrl 
    ? `${supabaseProjectUrl}/editor?table=scrape_events&filter=source_id:eq:${context.source_id}`
    : '(Configure SUPABASE_URL in environment)';
  
  const runbookLink = 'https://github.com/wesleykoot-jpg/LCL-Local/blob/main/docs/runbook.md';
  
  const text = [
    `*[CRITICAL]* Scraper failure — source: ${context.source_id} — ${context.consecutive_failures} consecutive failures*`,
    `• source_id: ${context.source_id}`,
    `• url: ${context.url}`,
    `• run_id: ${context.run_id}`,
    `• first_failure: ${context.first_failure_at || 'N/A'}`,
    `• last_failure: ${context.last_failure_at || 'N/A'}`,
    `• http_statuses: {${statusSummary || 'none'}}`,
    `• error_excerpt: "${context.error_excerpt || 'N/A'}"`,
    `• supabase_events: ${supabaseLink}`,
    '',
    '*Why it likely happened:*',
    `> ${cause}`,
    '',
    '*Suggested improvement:*',
    `> ${suggestion}`,
    '',
    `*Runbook:* ${runbookLink}`,
  ].join('\n');
  
  return { text };
}

/**
 * Send alert to Slack webhook
 */
export async function sendSlackAlert(
  context: AlertContext,
  dryRun: boolean = false
): Promise<void> {
  const config = getConfig();
  
  if (dryRun) {
    console.log('[DRY RUN] Would send Slack alert:', JSON.stringify(context, null, 2));
    return;
  }
  
  if (!config.slackWebhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not configured, skipping alert');
    return;
  }
  
  const payload = formatSlackMessage(context, config.supabaseUrl);
  
  try {
    await axios.post(config.slackWebhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log(`✓ Slack alert sent for source: ${context.source_id}`);
  } catch (error) {
    console.error('Failed to send Slack alert:', error instanceof Error ? error.message : 'unknown error');
    throw error;
  }
}

/**
 * Main function to handle alerting logic with suppression
 */
export async function handleAlert(
  source_id: string,
  url: string,
  run_id: string,
  consecutiveFailures: number,
  maxConsecutiveFailures: number,
  alertSuppressionMs: number,
  dryRun: boolean = false
): Promise<boolean> {
  // Check if we've reached the failure threshold
  if (consecutiveFailures < maxConsecutiveFailures) {
    return false;
  }
  
  // Check if we should suppress this alert
  const shouldAlert = await shouldSendAlert(source_id, alertSuppressionMs);
  
  if (!shouldAlert) {
    console.log(`⊘ Alert suppressed for source ${source_id} (within suppression window)`);
    return false;
  }
  
  // Build context and send alert
  const context = await buildAlertContext(source_id, url, run_id, consecutiveFailures);
  await sendSlackAlert(context, dryRun);
  
  return true;
}
