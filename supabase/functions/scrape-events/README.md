# Event Scraper - Edge Function

## Summary
- Scraping now aggregates results across all configured selectors, with deduplication by DOM identity/title+link.
- Title/date heuristics expanded (data attributes, aria labels, localized months/relative terms) and detail-page time parsing supports AM/PM.
- Duplicate detection normalizes stored timestamps; Gemini parsing is mockable for unit testing.
- **PageFetcher pattern** separates HTML retrieval from parsing, enabling pluggable fetch strategies.

## Architecture

### Edge Function Entry Point
**File:** [`index.ts`](./index.ts)

The main Supabase Edge Function that handles HTTP requests to scrape events from configured sources.

**Request Format:**
```json
{
  "sourceId": "source-id-from-database",
  "dryRun": true,  // Optional: test without writing to database
  "enableDeepScraping": true  // Optional: enable detailed event parsing
}
```

**Environment Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` - AI API key for event extraction (optional)

**Response:**
Returns JSON with scraping results, including:
- `success`: boolean
- `stats`: scraping statistics (total events, new events, duplicates)
- `events`: array of scraped events (if dry-run)
- `errors`: array of errors encountered

## PageFetcher Pattern

The scraper uses a `PageFetcher` abstraction to separate HTML fetching from parsing logic:

### Architecture
- **`PageFetcher` interface**: Defines `fetchPage(url)` returning `{ html, finalUrl, statusCode }`
- **`StaticPageFetcher`**: Default implementation using standard HTTP requests with user-agent spoofing
- **`DynamicPageFetcher`**: Placeholder stub for future headless browser support (Puppeteer/Playwright/ScrapingBee)

**Implementation Files:**
- [`../shared/strategies.ts`](../_shared/strategies.ts) - Fetcher implementations and factory function

### Usage
```typescript
import { StaticPageFetcher, DynamicPageFetcher, createFetcherForSource } from "../_shared/strategies.ts";

// Use factory function (recommended)
const fetcher = createFetcherForSource(source);
const result = await fetcher.fetchPage(url);

// Or create directly
const staticFetcher = new StaticPageFetcher(fetch, customHeaders, timeout);
const { html, finalUrl, statusCode } = await staticFetcher.fetchPage(url);
```

### Future Work: Dynamic Fetcher Configuration
To enable per-source fetcher selection:

1. **Add `fetcher` field to `scraper_sources` config:**
   ```sql
   ALTER TABLE scraper_sources 
   ADD COLUMN fetcher_type VARCHAR(20) DEFAULT 'static';
   -- Values: 'static' or 'dynamic'
   ```

2. **Update `createFetcherForSource` to read config:**
   ```typescript
   export function createFetcherForSource(source: ScraperSource): PageFetcher {
     if (source.config.fetcher === 'dynamic' || source.requires_render) {
       return new DynamicPageFetcher();
     }
     return new StaticPageFetcher(fetch, source.config.headers, 15000);
   }
   ```

3. **Implement `DynamicPageFetcher`** using Puppeteer, Playwright, or a service like ScrapingBee:
   ```typescript
   export class DynamicPageFetcher implements PageFetcher {
     async fetchPage(url: string) {
       const browser = await puppeteer.launch();
       const page = await browser.newPage();
       await page.goto(url);
       const html = await page.content();
       await browser.close();
       return { html, finalUrl: page.url(), statusCode: 200 };
     }
   }
   ```

### Migration Notes
- The deprecated `createSpoofedFetch()` function is maintained for backward compatibility
- All internal code now uses `PageFetcher` interface
- No changes to database schema or scraping outputs

## Local Development

### Running Tests
Unit tests for the scraper logic:

```bash
# Run Deno tests
deno test --allow-net --allow-read --allow-env tests/scraper_unit_test.ts

# Run specific test file
deno test --allow-net --allow-read --allow-env tests/scraper_config.test.ts
```

### Local Testing with Supabase CLI

1. **Start local Supabase:**
   ```bash
   npx supabase start
   ```

2. **Serve the function locally:**
   ```bash
   npx supabase functions serve scrape-events --env-file .env.local
   ```

3. **Test the function:**
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/scrape-events' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{"sourceId":"test-source-id","dryRun":true,"enableDeepScraping":true}'
   ```

### Environment File Example (`.env.local`)
```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
GEMINI_API_KEY=your-gemini-api-key  # Optional
```

## Dry-Run Mode

### Using the Dry-Run Script

Use [`scripts/run-scraper-dryrun.sh`](../../../scripts/run-scraper-dryrun.sh) to test scraping without writing to the database:

```bash
# Set environment variables
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run dry-run for a specific source
./scripts/run-scraper-dryrun.sh <source-id>

# Output is saved to scripts/dryrun-<source-id>.json
```

**What dry-run does:**
- Fetches and parses events from the source
- Returns statistics and event data in the response
- **Does NOT** write events to the database
- **Does NOT** send Slack alerts
- Useful for testing scraper configuration and debugging

**Finding Source IDs:**
```sql
SELECT id, name, url FROM scraper_sources WHERE enabled = true;
```

### Dry-Run vs Real Run

| Mode | Database Writes | Alerts | Use Case |
|------|----------------|--------|----------|
| **Dry-run** | ❌ No | ❌ No | Testing, debugging, validation |
| **Real run** | ✅ Yes | ✅ Yes | Production scraping via GitHub Actions |

**Real runs** are executed by:
- GitHub Actions workflow: [`.github/workflows/scrape.yml`](../../../.github/workflows/scrape.yml)
- Scheduled: Daily at 03:00 UTC
- Manual: Via workflow dispatch

## Deployment

### Automatic Deployment (via PR)
When you modify files in `supabase/functions/scrape-events/`, the deployment workflow automatically runs:

**Workflow:** [`.github/workflows/deploy-supabase-functions-on-pr.yml`](../../../.github/workflows/deploy-supabase-functions-on-pr.yml)

**Triggers:**
- Pull request opened, synchronized, reopened, or marked ready for review
- Only when files under `supabase/functions/**` are changed

**Required Secrets:**
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

### Manual Deployment

Deploy the function manually using Supabase CLI:

```bash
# Deploy to production
npx supabase functions deploy scrape-events --project-ref <your-project-ref>

# Deploy with custom environment variables
npx supabase functions deploy scrape-events \
  --project-ref <your-project-ref> \
  --set-env GEMINI_API_KEY=your-key
```

See [GitHub Workflows README](../../../.github/workflows/README.md) for more deployment details.

## Validation and Testing

### Before/After Validation
- Run the dry-run script for at least three representative sources (e.g., Ontdek Meppel and two other agendas) before and after these changes.
- Compare `stats.totalEventsScraped`; if the difference exceeds 10%, inspect logs for skipped items and add selectors where needed.
- Capture any remaining site-specific issues and recommended selectors in the PR notes.

## Related Documentation

- **Operational Runbook:** [`docs/runbook.md`](../../../docs/runbook.md) - Monitoring, troubleshooting, and responding to failures
- **GitHub Workflows:** [`../.github/workflows/README.md`](../../../.github/workflows/README.md) - Workflow documentation
- **Shared Utilities:** [`../_shared/`](../_shared/) - Common utilities used by all Edge Functions
- **Monitoring:** [`lcl-monitoring/`](../../../lcl-monitoring/) - Telemetry and monitoring stack
