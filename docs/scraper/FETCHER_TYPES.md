# Fetcher Types Configuration Guide

## Overview

The scraper system now supports multiple fetching strategies that can be
configured per-source in the database. This allows you to choose the best
approach for each website you're scraping.

## Available Fetcher Types

### 1. Static (Default)

Standard HTTP requests - fast and efficient for most websites.

**Use when:**

- Site content is rendered server-side
- No JavaScript required to load content
- Simple HTML pages

**Configuration:**

```sql
UPDATE scraper_sources 
SET fetcher_type = 'static',
    config = jsonb_set(config, '{headers}', '{"User-Agent": "CustomBot/1.0"}')
WHERE id = 'your-source-id';
```

### 2. Puppeteer

Headless Chrome automation for JavaScript-heavy sites.

**Use when:**

- Content is dynamically loaded via JavaScript
- Need to interact with page elements
- Site requires JavaScript execution

**Configuration:**

```sql
UPDATE scraper_sources 
SET fetcher_type = 'puppeteer',
    config = jsonb_set(
      jsonb_set(
        jsonb_set(config, '{headless}', 'true'),
        '{wait_for_selector}', '".event-card"'
      ),
      '{wait_for_timeout}', '30000'
    )
WHERE id = 'your-source-id';
```

**Config Options:**

- `headless` (boolean): Run browser in headless mode (default: true)
- `wait_for_selector` (string): CSS selector to wait for before scraping
- `wait_for_timeout` (number): Timeout in milliseconds (default: 30000)

### 3. Playwright

Alternative to Puppeteer with better cross-browser support.

**Use when:**

- Same scenarios as Puppeteer
- Need Firefox or WebKit support
- Prefer Playwright's API

**Configuration:**

```sql
UPDATE scraper_sources 
SET fetcher_type = 'playwright',
    config = jsonb_set(
      jsonb_set(config, '{headless}', 'true'),
      '{wait_for_selector}', '".content-loaded"'
    )
WHERE id = 'your-source-id';
```

**Config Options:** Same as Puppeteer

### 4. ScrapingBee

Managed rendering service for complex sites with anti-bot protection.

**Use when:**

- Site has aggressive anti-bot measures
- Need residential proxies
- Don't want to manage browser instances

**Configuration:**

```sql
-- Set API key in environment: SCRAPINGBEE_API_KEY
-- Or in config:
UPDATE scraper_sources 
SET fetcher_type = 'scrapingbee',
    config = jsonb_set(
      jsonb_set(config, '{scrapingbee_api_key}', '"YOUR_API_KEY"'),
      '{wait_for_timeout}', '5000'
    )
WHERE id = 'your-source-id';
```

**Config Options:**

- `scrapingbee_api_key` (string): Your ScrapingBee API key
- `wait_for_timeout` (number): Wait time in milliseconds before scraping

## Retry Logic

All fetchers include automatic retry with exponential backoff:

- **Max retries:** 3 attempts
- **Initial delay:** 1 second
- **Max delay:** 10 seconds
- **Backoff multiplier:** 2x

This handles transient network issues and temporary site unavailability.

## Automatic Failover (Waterfall Strategy)

The system now implements a proactive **Waterfall Strategy** for sources
configured as `static`. This ensures that tough-to-scrape sites are handled
gracefully without manual intervention.

### How it works:

1. **Initial Attempt**: The scraper starts with the fast, free
   `StaticPageFetcher`.
2. **Failure Detection**: If the static fetch fails 3 times consecutively (e.g.,
   due to 403 Forbidden or timeouts).
3. **Automatic Escalation**: The system automatically switches to the
   `FailoverPageFetcher`.
4. **Dynamic Upgrade**: The fetcher seamlessly upgrades to a
   `DynamicPageFetcher` (using ScrapingBee or Puppeteer) for the remainder of
   the job session.

**Benefits:**

- Keeping sources as `static` by default saves costs.
- Hard sources are automatically "healed" by upgrading to a more powerful
  fetcher.
- No manual config change is required for intermittent issues.

This ensures scraping continues even when sites add temporary bot protection.

## Migration Example

To migrate an existing source from static to dynamic:

```sql
-- Check current configuration
SELECT id, name, fetcher_type, config 
FROM scraper_sources 
WHERE id = 'your-source-id';

-- Update to Puppeteer with custom config
UPDATE scraper_sources 
SET 
  fetcher_type = 'puppeteer',
  config = config || jsonb_build_object(
    'headless', true,
    'wait_for_selector', '.event-card',
    'wait_for_timeout', 30000
  )
WHERE id = 'your-source-id';
```

## Best Practices

1. **Start with Static**: Try static fetcher first - it's fastest and uses least
   resources
2. **Monitor Performance**: Track scraping success rates to determine if dynamic
   fetching is needed
3. **Use Selectors Wisely**: Only use `wait_for_selector` when necessary - it
   adds delay
4. **Set Appropriate Timeouts**: Balance between giving pages time to load and
   keeping scrapes fast
5. **Test Thoroughly**: Test new fetcher configurations in dry-run mode first

## Troubleshooting

### Puppeteer/Playwright not working

- Ensure libraries are installed in Supabase Edge Functions environment
- Check browser dependencies are available
- Verify headless mode works in your environment

### ScrapingBee errors

- Verify API key is valid (min 20 characters)
- Check API quota hasn't been exceeded
- Ensure SCRAPINGBEE_API_KEY environment variable is set

### Slow scraping

- Reduce `wait_for_timeout` if pages load faster
- Remove `wait_for_selector` if not needed
- Consider using static fetcher for simpler sites

## Performance Comparison

| Fetcher Type | Speed  | Resource Usage | Success Rate | Cost |
| ------------ | ------ | -------------- | ------------ | ---- |
| Static       | Fast   | Low            | 70-80%       | Free |
| Puppeteer    | Slow   | High           | 85-95%       | Free |
| Playwright   | Slow   | High           | 85-95%       | Free |
| ScrapingBee  | Medium | Low            | 95-99%       | Paid |

## Examples

### Simple Blog

```sql
-- Static fetcher is sufficient
UPDATE scraper_sources 
SET fetcher_type = 'static'
WHERE url LIKE '%wordpress.com%';
```

### React/Vue SPA

```sql
-- Needs JavaScript execution
UPDATE scraper_sources 
SET 
  fetcher_type = 'puppeteer',
  config = config || '{"headless": true, "wait_for_timeout": 10000}'::jsonb
WHERE url LIKE '%react-site.com%';
```

### Site with Bot Protection

```sql
-- Use ScrapingBee for best success rate
UPDATE scraper_sources 
SET 
  fetcher_type = 'scrapingbee',
  config = config || '{"wait_for_timeout": 5000}'::jsonb
WHERE url LIKE '%protected-site.com%';
```

## See Also

- [Scraper Configuration](./SCRAPER_IMPROVEMENTS.md)
- [Database Schema](../supabase/migrations/20260114094900_add_fetcher_type.sql)
- [Implementation](../supabase/functions/scrape-events/strategies.ts)
