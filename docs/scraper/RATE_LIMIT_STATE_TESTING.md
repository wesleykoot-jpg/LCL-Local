# Rate-Limit State UI Testing Guide

## Overview
This guide explains how to test the new rate-limit state display in the Scraper Admin UI.

## Prerequisites
- Access to Supabase database
- Admin UI access
- At least one scraper source configured

## Test Scenarios

### Scenario 1: Manual Database Test
Test the UI by manually setting rate-limit values in the database.

#### Steps:
1. Connect to your Supabase database (via SQL Editor or psql)

2. Update a test source with rate-limit data:
```sql
UPDATE public.scraper_sources
SET 
  last_rate_limit_remaining = 50,
  last_rate_limit_reset_ts = now() + interval '2 hours',
  last_rate_limit_retry_after_seconds = 120,
  updated_at = now()
WHERE name = 'Your Test Source Name';
```

3. Navigate to the Admin UI at `/admin`

4. Find the source you updated

5. **Expected Result**: You should see an amber warning box below the source URL with:
   - "Remaining: **50**"
   - "Reset: **2h ago**" (or similar relative time)
   - "Retry-after: **120s**"

### Scenario 2: Verify Null Handling
Ensure the UI doesn't break when fields are null.

#### Steps:
1. Clear rate-limit data for a source:
```sql
UPDATE public.scraper_sources
SET 
  last_rate_limit_remaining = NULL,
  last_rate_limit_reset_ts = NULL,
  last_rate_limit_retry_after_seconds = NULL,
  updated_at = now()
WHERE name = 'Your Test Source Name';
```

2. Refresh the Admin UI

3. **Expected Result**: The amber warning box should NOT appear for this source

### Scenario 3: Partial Data Test
Test with only some fields populated.

#### Steps:
1. Set only retry-after value:
```sql
UPDATE public.scraper_sources
SET 
  last_rate_limit_remaining = NULL,
  last_rate_limit_reset_ts = NULL,
  last_rate_limit_retry_after_seconds = 60,
  updated_at = now()
WHERE name = 'Your Test Source Name';
```

2. Refresh the Admin UI

3. **Expected Result**: Amber warning box should show only "Retry-after: **60s**"

### Scenario 4: Real Rate-Limit Response
Test with an actual rate-limited scraper response (if available).

#### Steps:
1. Trigger a scrape on a source that returns 429 responses

2. Wait for the scraper to complete

3. Check the Admin UI

4. **Expected Result**: If the API returns rate-limit headers, they should be displayed in the UI

## UI Appearance

The rate-limit display appears as:
- **Location**: Below the source URL and error messages
- **Style**: Amber/yellow warning box with AlertTriangle icon
- **Border**: Subtle amber border with light amber background
- **Icon**: Warning triangle (⚠️) on the left
- **Fields**: Horizontally aligned, space-separated

## Troubleshooting

### Fields Not Showing
- Check that `getSources()` in `scraperService.ts` selects all columns (it should with `SELECT *`)
- Verify database migration ran successfully
- Check browser console for JavaScript errors

### Timestamp Formatting Issues
- The `formatRelativeTime` function should handle null values gracefully
- Check that `last_rate_limit_reset_ts` is a valid ISO timestamp

### Missing Icon
- Ensure `AlertTriangle` is imported from 'lucide-react'
- Check that the component renders without React errors

## Additional Verification

### Database Query to See Rate-Limit State
```sql
SELECT 
  name,
  enabled,
  last_rate_limit_remaining,
  last_rate_limit_reset_ts,
  last_rate_limit_retry_after_seconds,
  consecutive_failures,
  last_scraped_at
FROM public.scraper_sources
WHERE 
  last_rate_limit_remaining IS NOT NULL 
  OR last_rate_limit_reset_ts IS NOT NULL 
  OR last_rate_limit_retry_after_seconds IS NOT NULL
ORDER BY updated_at DESC;
```

### Edge Function Logs
Check Supabase logs for rate-limit parsing:
```
Rate limit increased for source <uuid> from X to Y ms (retry_after: Zs, remaining: N, reset: <timestamp>)
```

## Migration Verification

Verify migrations applied successfully:
```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'scraper_sources'
  AND column_name IN (
    'last_rate_limit_remaining',
    'last_rate_limit_reset_ts', 
    'last_rate_limit_retry_after_seconds'
  );

-- Check RPC function signature
SELECT 
  routine_name,
  data_type,
  parameter_name,
  parameter_mode
FROM information_schema.parameters
WHERE specific_name LIKE 'increase_source_rate_limit%'
ORDER BY ordinal_position;
```

## Success Criteria
- ✅ Columns exist in database
- ✅ RPC function accepts new parameters
- ✅ Edge function parses headers correctly
- ✅ UI displays rate-limit state when present
- ✅ UI handles null values gracefully
- ✅ No JavaScript errors in console
- ✅ Amber warning styling is applied correctly
