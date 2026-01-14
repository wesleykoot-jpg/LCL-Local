# Scraper Improvements Summary

## Changes Made

### 1. Image Prioritization Fixed ✅

**Problem**: The AI-parsed image was being prioritized over the originally scraped image, which could result in lower quality or less relevant images.

**Solution**: Changed the image selection logic in all three scraper functions to prioritize scraped images:

```typescript
// Before (incorrect):
image_url: parsed.image_url ?? rawEvent.imageUrl ?? null

// After (correct):
image_url: rawEvent.imageUrl ?? parsed.image_url ?? null
```

**Behavior**: 
- First priority: Use the image scraped from the event listing page
- Fallback: If no scraped image, use AI-provided image URL
- Last resort: null if neither is available

**Files Changed**:
- `supabase/functions/run-scraper/index.ts`
- `supabase/functions/scrape-worker/index.ts`
- `supabase/functions/scrape-events/index.ts`

---

### 2. Coordinate Logging Added ✅

**Problem**: When venues don't receive coordinates, it's difficult to debug which sources are missing coordinate configuration.

**Solution**: Added warning logs when coordinates are missing:

```typescript
if (!defaultCoords) {
  console.warn(`No coordinates found for source: ${source.name} (${source.id}). Using fallback POINT(0 0)`);
}
```

**Behavior**:
- Checks both `source.default_coordinates` and `source.config.default_coordinates`
- Logs a warning if neither is present
- Falls back to `POINT(0 0)` (coordinates at null island)
- Makes it easy to identify which sources need coordinate configuration

**Files Changed**:
- `supabase/functions/run-scraper/index.ts`
- `supabase/functions/scrape-worker/index.ts`
- `supabase/functions/scrape-events/index.ts`

---

### 3. Slack Webhook Notifications Implemented ✅

**Problem**: Slack webhook notifications were mentioned in documentation but not implemented in code.

**Solution**: Added Slack webhook integration to all scraper functions:

```typescript
async function sendSlackNotification(
  webhookUrl: string,
  message: string,
  isError: boolean = false
): Promise<void>
```

**Features**:
- Reads webhook URL from `SLACK_WEBHOOK_URL` environment variable
- Sends notifications for:
  - ✅ Successful scraper runs with statistics (events scraped, inserted, duplicates, failed)
  - ❌ Scraper errors with error messages
  - 📊 Individual job completions and failures (in scrape-worker)
- Includes color-coded attachments (green for success, red for errors)
- Does not send notifications during dry-run mode (except for errors)
- Fails gracefully if webhook URL is not configured

**Notification Examples**:

Success notification:
```
🎉 Scraper Run Complete (run_2026-01-14T01-30-00)
Sources: 5
Scraped: 42 | Inserted: 38
Duplicates: 3 | Failed: 1
```

Error notification:
```
❌ Scraper Error
Failed to connect to source: Connection timeout
```

**Setup Instructions**:
1. Create an incoming webhook in Slack workspace
2. Add `SLACK_WEBHOOK_URL` to environment variables
3. Example: `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL`

**Files Changed**:
- `supabase/functions/run-scraper/index.ts`
- `supabase/functions/scrape-worker/index.ts`
- `supabase/functions/scrape-events/index.ts`
- `.env.example` (added documentation)

---

## Testing

All changes have been:
1. ✅ Verified through unit tests
2. ✅ Tested with verification script
3. ✅ Confirmed not to break existing functionality (npm test passes)

## Configuration

Add to your Supabase Edge Function secrets or environment variables:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

To test locally:
```bash
# In .env or Supabase CLI config
SLACK_WEBHOOK_URL=your-webhook-url
```

## Monitoring

After deployment, monitor:
1. **Slack channel** for scraper notifications
2. **Function logs** for coordinate warnings
3. **Event images** to ensure high-quality images are used

## Notes

- Coordinate logging helps identify sources needing configuration updates
- Image prioritization ensures better user experience with higher quality images
- Slack notifications provide real-time monitoring without checking logs
- All changes are backward compatible and fail gracefully
