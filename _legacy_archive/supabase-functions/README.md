# Archived Supabase Edge Functions

This directory should contain the following archived Edge Functions:

## Functions to Move Here

From `supabase/functions/`:

1. **scrape-coordinator/** - Main orchestrator for scraping jobs
2. **scrape-events/** - Core event extraction logic  
3. **process-worker/** - Pipeline processing worker
4. **source-discovery-coordinator/** - Source discovery orchestration
5. **source-discovery-worker/** - Source discovery execution
6. **cleanup-sources/** - Source maintenance
7. **backfill-coordinates/** - Geocoding backfill

## Shared Utilities to Move

From `supabase/functions/_shared/`:

- `aiParsing.ts`
- `categorizer.ts`
- `categoryMapping.ts`
- `circuitBreaker.ts`
- `cmsFingerprinter.ts`
- `dataExtractors.ts`
- `dateUtils.ts`
- `dlq.ts`
- `dutchMunicipalities.ts`
- `enrichment.ts`
- `jsonLdParser.ts`
- `rateLimitParsing.ts`
- `rateLimiting.ts`
- `scraperInsights.ts`
- `scraperObservability.ts`
- `scraperUtils.ts`
- `serverRateLimiting.ts`
- `slack.ts`
- `strategies.ts`

## Move Command

Run from repository root:

```bash
# Create archive directories
mkdir -p _legacy_archive/supabase-functions/_shared

# Move Edge Functions
mv supabase/functions/scrape-coordinator _legacy_archive/supabase-functions/
mv supabase/functions/scrape-events _legacy_archive/supabase-functions/
mv supabase/functions/process-worker _legacy_archive/supabase-functions/
mv supabase/functions/source-discovery-coordinator _legacy_archive/supabase-functions/
mv supabase/functions/source-discovery-worker _legacy_archive/supabase-functions/
mv supabase/functions/cleanup-sources _legacy_archive/supabase-functions/
mv supabase/functions/backfill-coordinates _legacy_archive/supabase-functions/

# Move shared scraper utilities
mv supabase/functions/_shared/aiParsing.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/categorizer.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/categoryMapping.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/circuitBreaker.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/cmsFingerprinter.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/dataExtractors.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/dateUtils.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/dlq.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/dutchMunicipalities.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/enrichment.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/jsonLdParser.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/rateLimitParsing.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/rateLimiting.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/scraperInsights.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/scraperObservability.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/scraperUtils.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/serverRateLimiting.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/slack.ts _legacy_archive/supabase-functions/_shared/
mv supabase/functions/_shared/strategies.ts _legacy_archive/supabase-functions/_shared/
```
