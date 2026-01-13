# Scraper coverage improvements

## Summary
- Scraping now aggregates results across all configured selectors, with deduplication by DOM identity/title+link.
- Title/date heuristics expanded (data attributes, aria labels, localized months/relative terms) and detail-page time parsing supports AM/PM.
- Duplicate detection normalizes stored timestamps; Gemini parsing is mockable for unit testing.

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
