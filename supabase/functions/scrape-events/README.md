# Scraper coverage improvements

## Summary
- Scraping now aggregates results across all configured selectors, with deduplication by DOM identity/title+link.
- Title/date heuristics expanded (data attributes, aria labels, localized months/relative terms) and detail-page time parsing supports AM/PM.
- Duplicate detection normalizes stored timestamps; Gemini parsing is mockable for unit testing.
- **NEW**: PageFetcher pattern separates HTML retrieval from parsing, enabling pluggable fetch strategies.

## PageFetcher Pattern

The scraper now uses a `PageFetcher` abstraction to separate HTML fetching from parsing logic:

### Architecture
- **`PageFetcher` interface**: Defines `fetchPage(url)` returning `{ html, finalUrl, statusCode }`
- **`StaticPageFetcher`**: Default implementation using standard HTTP requests with user-agent spoofing
- **`DynamicPageFetcher`**: Placeholder stub for future headless browser support (Puppeteer/Playwright/ScrapingBee)

### Usage
```typescript
import { StaticPageFetcher, DynamicPageFetcher, createFetcherForSource } from "./strategies.ts";

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

## Tests
- Unit tests: `deno test --allow-net --allow-read --allow-env tests/scraper_unit_test.ts`

## Dry-run integration
Use `scripts/run-scraper-dryrun.sh` to compare scraped counts with site totals:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/run-scraper-dryrun.sh <source-id>
```

To find source ids:
```sql
SELECT id, name, url FROM scraper_sources WHERE name ILIKE '%Meppel%';
```

## Before/after validation
- Run the dry-run script for at least three representative sources (e.g., Ontdek Meppel and two other agendas) before and after these changes.
- Compare `stats.totalEventsScraped`; if the difference exceeds 10%, inspect logs for skipped items and add selectors where needed.
- Capture any remaining site-specific issues and recommended selectors in the PR notes.
