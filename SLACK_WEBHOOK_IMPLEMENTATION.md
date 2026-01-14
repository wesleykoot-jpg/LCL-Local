# Slack Webhook Implementation Guide

## Overview
This document describes the improved Slack webhook notification system implemented in Phase 2 & 3 of the scraper improvements.

## Key Changes

### Phase 2: Fix & Improve Slack Webhook

#### 1. Environment Variable Reading (`_shared/slack.ts`)
- **Before**: Webhook URL was passed as a parameter to `sendSlackNotification()`
- **After**: Webhook URL is automatically read from `SLACK_WEBHOOK_URL` environment variable
- **Benefit**: Centralized configuration, no need to pass webhook URL throughout the codebase

#### 2. Defensive Error Handling
- **Implementation**: All Slack notification failures are now caught and logged as warnings
- **Benefit**: Scraper operations never crash due to Slack notification failures
- **Example**: If Slack API is down, scraping continues normally and errors are logged

#### 3. Block Kit Support
The `sendSlackNotification()` function now supports two formats:

**Simple Text Message:**
```typescript
await sendSlackNotification("Simple text message", false);
```

**Block Kit (Rich Formatting):**
```typescript
await sendSlackNotification({
  blocks: [
    {
      type: "header",
      text: { type: "plain_text", text: "🚀 Title" }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: "*Field:*\nValue" }
      ]
    }
  ]
}, false);
```

### Scrape Coordinator Enhanced Notifications

The `scrape-coordinator` function now sends comprehensive Block Kit notifications including:

#### Summary Section
- **Total Municipalities Checked**: Number of sources processed
- **Jobs Created**: Number of scrape jobs enqueued
- **New Events (24h)**: Events inserted in last 24 hours
- **Worker Triggered**: Whether the worker chain was started

#### Persona Impact Section
- **Family Events**: Count of family-oriented events (👨‍👩‍👧‍👦)
- **Social Events**: Count of social/culture/nightlife events (🍷)

#### Error Section (if applicable)
- Lists sources that failed in the last 24 hours
- Shows error messages and URLs for debugging
- Limited to top 10 failures

#### Geofencing Sample
- Shows up to 5 sources with coordinates
- Displays: `Source Name (Location): lat, lng`
- Verifies geofencing is working nationwide

### Phase 3: Defensive Logging

#### 1. High-Value Anchor Source Alerts (`source-discovery/index.ts`)

When a high-value source is discovered, an automatic Slack alert is sent with:
- **Criteria**: Major municipality (pop > 100k) AND confidence ≥ 80%
- **Information Included**:
  - Source name and municipality (with population)
  - Confidence score
  - Category
  - Coordinates for geofencing
  - URL
  - Status: Added as disabled for manual review

#### 2. Coordinates in Logs (`scrape-worker/index.ts`)

All worker logs now include coordinate information:
```
Worker: Completed job abc-123 - scraped: 45, inserted: 12, duplicates: 33 | Coordinates: 52.3676, 4.9041
```

Slack notifications also include coordinates:
```
✅ Job abc-123 completed
Source: Amsterdam Events
Scraped: 45 | Inserted: 12 | Duplicates: 33
📍 52.3676, 4.9041
```

## Configuration

### Setting Up Slack Webhook

1. Create a Slack Incoming Webhook:
   - Go to https://api.slack.com/apps
   - Create a new app or select existing
   - Enable "Incoming Webhooks"
   - Create a new webhook URL

2. Set the environment variable in Supabase:
   ```bash
   # In Supabase Dashboard > Settings > Edge Functions > Secrets
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

3. The webhook is automatically used by all functions:
   - `scrape-coordinator`
   - `scrape-worker`
   - `scrape-events`
   - `run-scraper`
   - `source-discovery`

## Testing

### Manual Testing

1. **Test Simple Notification:**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/scrape-coordinator \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"triggerWorker": false}'
   ```

2. **Verify Block Kit Formatting:**
   - Check Slack channel for rich formatted message
   - Verify all sections appear correctly
   - Confirm coordinates are displayed

3. **Test Error Handling:**
   - Temporarily set invalid SLACK_WEBHOOK_URL
   - Trigger a scrape job
   - Verify scraping continues despite Slack failure
   - Check logs for warning messages

### Monitoring

Check the following in Slack notifications:

1. **Coordinator Notifications:**
   - Appear after job enqueueing
   - Show current statistics
   - Include error summaries if any

2. **Worker Notifications:**
   - One per completed job
   - Include coordinates
   - Show success/failure status

3. **Discovery Notifications:**
   - Only for high-value sources
   - Immediately when discovered
   - Include full source details

## Troubleshooting

### Notifications Not Appearing

1. **Check Environment Variable:**
   ```bash
   # In Supabase Edge Function logs
   console.log(Deno.env.get("SLACK_WEBHOOK_URL"));
   ```

2. **Verify Webhook URL:**
   - Test directly with curl:
   ```bash
   curl -X POST YOUR_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"text": "Test message"}'
   ```

3. **Check Logs:**
   - Look for "Slack notification sent successfully" (success)
   - Look for "Failed to send Slack notification" (failure)
   - Error details are logged but don't crash the process

### Block Kit Not Rendering

1. **Validate Block Structure:**
   - Use Slack Block Kit Builder: https://app.slack.com/block-kit-builder
   - Copy your blocks structure and test

2. **Check Payload Size:**
   - Slack has a 3000-character limit per text block
   - Error lists are truncated to 2000 characters
   - If issues persist, reduce content size

### Coordinates Missing

1. **Check Source Configuration:**
   - Ensure `default_coordinates` is set in `scraper_sources` table
   - Format: `{"lat": 52.3676, "lng": 4.9041}`

2. **Fallback Behavior:**
   - If coordinates missing, logs show: "📍 No coordinates"
   - Events still created with `POINT(0 0)` fallback

## Future Enhancements

Potential improvements for future iterations:

1. **Aggregated Notifications**: Batch multiple worker completions into single message
2. **Thread Replies**: Use Slack threads for detailed breakdowns
3. **Interactive Buttons**: Add buttons to re-run failed sources
4. **Slack Charts**: Use Chart.js or similar for visual statistics
5. **Alert Levels**: Critical/Warning/Info severity levels
6. **Custom Channels**: Route different notification types to different channels

## Related Files

- `/supabase/functions/_shared/slack.ts` - Core notification utility
- `/supabase/functions/scrape-coordinator/index.ts` - Coordinator with Block Kit
- `/supabase/functions/scrape-worker/index.ts` - Worker with coordinates logging
- `/supabase/functions/source-discovery/index.ts` - Discovery alerts
- `/supabase/functions/run-scraper/index.ts` - Scraper notifications
- `/supabase/functions/scrape-events/index.ts` - Event scraper notifications
