# Scraper Pipeline Test Plan

## Overview

This document outlines a comprehensive testing plan for the new scraper logic, focusing on the Scout-Execute-Self-Heal architecture and the integration between Scout Worker, Scrape Coordinator, Scrape Events, and Process Worker.

## Architecture Overview

The scraper pipeline consists of four main components:

### 1. Scout Worker (`supabase/functions/scout-worker/index.ts`)
- **Purpose**: AI-powered analysis of website HTML structure
- **Function**: Generates deterministic extraction recipes using GLM-4.7/OpenAI
- **Trigger**: When `scout_status = 'pending_scout'` or `'needs_re_scout'`
- **Output**: Saves extraction recipes to database

### 2. Scrape Coordinator (`supabase/functions/scrape-coordinator/index.ts`)
- **Purpose**: Orchestrates scraping jobs across all enabled sources
- **Function**: Enqueues jobs, triggers scrape-events and process-worker
- **Features**: Circuit breaker logic, volatility-based scheduling, error tracking
- **Recent Fixes**: Added authentication, rate limiting, consecutive_errors tracking

### 3. Scrape Events (`supabase/functions/scrape-events/index.ts`)
- **Purpose**: Executor tier - uses recipes to extract events
- **Function**: Fetches HTML, applies extraction recipes, stages raw events
- **Features**: Pagination support, recipe-based extraction, self-healing
- **Recent Fixes**: Added authentication, rate limiting, improved error handling

### 4. Process Worker (`supabase/functions/process-worker/index.ts`)
- **Purpose**: Processes and normalizes staged events
- **Function**: Claims pending rows, parses events, calculates quality scores
- **Features**: Hybrid parsing (AI + deterministic), DLQ integration, retries
- **Recent Fixes**: Quality score regex fix, backoff logic, DLQ integration

## Pipeline Flow

```mermaid
graph LR
    A[Scout Worker] -->|Generates Recipes| B[Database]
    B -->|Extraction Recipes| C[Scrape Coordinator]
    C -->|Enqueues Jobs| D[Scrape Events]
    D -->|Stages Raw Events| B
    B -->|Pending Rows| E[Process Worker]
    E -->|Normalized Events| B
    C -->|Triggers| E
```

## Testing Strategy

### Phase 1: Unit Testing (Mock Data)

**Test Suite**: [`run-scraper-sample-test.ts`](run-scraper-sample-test.ts:1)

**Purpose**: Validate scraper logic with controlled mock data

**Steps**:
1. Run the sample test suite locally
2. Validate extraction recipes are generated correctly
3. Test event card parsing and normalization
4. Verify quality scoring logic
5. Check deduplication works correctly

**Command**:
```bash
deno run -A run-scraper-sample-test.ts
```

**Expected Outcomes**:
- All sources pass basic assertions
- Events are parsed with correct date/time formats
- Quality scores are calculated accurately
- Deduplication prevents duplicate events

### Phase 2: Integration Testing (Real Sources)

**Purpose**: Test the full pipeline with real data sources

**Prerequisites**:
- Supabase environment configured
- Environment variables set (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- At least one source in `scraper_sources` table with `scout_status = 'pending_scout'`

**Steps**:

#### Step 1: Test Scout Worker
```bash
# Trigger scout worker for a specific source
curl -X POST https://your-project.supabase.co/functions/v1/scout-worker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "SOURCE_ID"}'

# Or run batch mode
curl -X POST https://your-project.supabase.co/functions/v1/scout-worker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 3}'
```

**Validation**:
- Check `scraper_sources` table for `scout_status = 'active'`
- Verify `extraction_recipe` column contains valid JSON
- Review logs for recipe generation success/failure

#### Step 2: Test Scrape Coordinator
```bash
# Trigger coordinator (will enqueue jobs for all eligible sources)
curl -X POST https://your-project.supabase.co/functions/v1/scrape-coordinator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Or trigger for specific sources
curl -X POST https://your-project.supabase.co/functions/v1/scrape-coordinator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceIds": ["SOURCE_ID_1", "SOURCE_ID_2"]}'
```

**Validation**:
- Check `scrape_jobs` table for new jobs
- Monitor `raw_event_staging` table for staged events
- Verify `consecutive_errors` tracking works
- Check rate limiting is enforced

#### Step 3: Test Scrape Events Directly
```bash
# Trigger scrape-events for a specific source
curl -X POST https://your-project.supabase.co/functions/v1/scrape-events \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "SOURCE_ID"}'
```

**Validation**:
- Verify events are staged in `raw_event_staging` table
- Check `last_payload_hash` is updated
- Verify pagination works (if applicable)
- Monitor for self-healing triggers (re-scout)

#### Step 4: Test Process Worker
```bash
# Trigger process worker
curl -X POST https://your-project.supabase.co/functions/v1/process-worker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Validation**:
- Check `events` table for normalized events
- Verify quality scores are calculated correctly
- Check DLQ for failed events
- Verify backoff logic works

### Phase 3: End-to-End Testing

**Purpose**: Test the complete pipeline from source to final events

**Steps**:
1. Add a new source to `scraper_sources` with `scout_status = 'pending_scout'`
2. Trigger Scout Worker
3. Wait for recipe generation
4. Trigger Scrape Coordinator
5. Monitor the full pipeline execution
6. Verify events appear in `events` table

**Validation Queries**:
```sql
-- Check scout status
SELECT id, name, scout_status, extraction_recipe->>'mode' as mode
FROM scraper_sources
WHERE id = 'YOUR_SOURCE_ID';

-- Check staged events
SELECT COUNT(*), status, parsing_method
FROM raw_event_staging
WHERE source_id = 'YOUR_SOURCE_ID'
GROUP BY status, parsing_method;

-- Check final events
SELECT COUNT(*), category, quality_score
FROM events
WHERE source_id = 'YOUR_SOURCE_ID'
GROUP BY category, quality_score;

-- Check errors
SELECT * FROM error_logs
WHERE source IN ('scout-worker', 'scrape-coordinator', 'scrape-events', 'process-worker')
ORDER BY created_at DESC
LIMIT 20;

-- Check rate limits
SELECT * FROM rate_limit_stats
ORDER BY created_at DESC
LIMIT 20;
```

## Recent Fixes to Validate

### 1. Quality Score Regex Fix
**File**: [`supabase/functions/process-worker/index.ts`](supabase/functions/process-worker/index.ts:104)

**What Changed**: Updated time validation regex from `/^\d{1,2}:\d{2}(:\d{2})?$/` to `/^([0-9]|[0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/`

**Test**: Verify times like "9:30", "09:30", "23:59" are accepted, while "25:30", "9:60" are rejected.

### 2. Backoff Logic
**File**: [`supabase/functions/process-worker/index.ts`](supabase/functions/process-worker/index.ts:248)

**What Changed**: Failed rows now use "pending_with_backoff" status with exponential backoff (5, 10, 20, 40... minutes)

**Test**: Trigger a failure and verify `updated_at` is set to future timestamp.

### 3. Authentication
**Files**: [`supabase/functions/_shared/auth.ts`](supabase/functions/_shared/auth.ts:1), applied to all edge functions

**What Changed**: Added API key validation with Bearer token or x-api-key header

**Test**: Try to trigger functions without API key (should fail 401), then with valid key (should succeed).

### 4. Rate Limiting
**Files**: [`supabase/functions/_shared/serverRateLimiting.ts`](supabase/functions/_shared/serverRateLimiting.ts:1), migration: [`supabase/migrations/20260126000000_server_side_rate_limiting.sql`](supabase/migrations/20260126000000_server_side_rate_limiting.sql:1)

**What Changed**: Database-backed rate limiting with sliding window algorithm

**Test**: Send multiple rapid requests and verify 429 responses after hitting limits.

### 5. Consecutive Errors Tracking
**File**: [`supabase/functions/scrape-coordinator/index.ts`](supabase/functions/scrape-coordinator/index.ts:167)

**What Changed**: Coordinator now tracks failed source IDs and updates `consecutive_errors` counter

**Test**: Trigger a failure and verify `consecutive_errors` is incremented in database.

## Monitoring and Debugging

### Key Tables to Monitor

```sql
-- Sources and their status
SELECT id, name, enabled, scout_status, consecutive_errors, last_scraped_at
FROM scraper_sources
ORDER BY last_scraped_at DESC;

-- Staged events
SELECT source_id, status, COUNT(*)
FROM raw_event_staging
GROUP BY source_id, status;

-- Final events
SELECT source_id, category, COUNT(*)
FROM events
GROUP BY source_id, category;

-- Error logs
SELECT source, function_name, error_type, COUNT(*)
FROM error_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY source, function_name, error_type;

-- Rate limit stats
SELECT * FROM rate_limit_stats
ORDER BY created_at DESC LIMIT 20;
```

### Key Metrics to Track

1. **Scout Success Rate**: Percentage of sources successfully scouted
2. **Extraction Success Rate**: Percentage of events successfully extracted
3. **Processing Success Rate**: Percentage of staged events successfully processed
4. **Quality Score Distribution**: Distribution of quality scores across events
5. **Error Rate**: Number of errors per function per hour
6. **Rate Limit Hits**: Number of rate limit violations

## Rollback Plan

If issues arise during testing:

1. **Remove Authentication**: Remove `withAuth()` wrapper from function handlers
2. **Remove Rate Limiting**: Remove `withRateLimiting()` wrapper from function handlers
3. **Revert Status Logic**: Change "pending_with_backoff" back to "failed" in failRow function
4. **Drop Rate Limiting Tables**: Run `DROP TABLE IF EXISTS public.rate_limits;`
5. **Revert Regex**: Change regex back to `/^\d{1,2}:\d{2}(:\d{2})?$/`

## Next Steps

1. Run Phase 1 (unit tests) to validate basic logic
2. Set up environment variables for Phase 2
3. Run Phase 2 (integration tests) with real sources
4. Monitor results and adjust as needed
5. Run Phase 3 (end-to-end tests) to validate complete pipeline
6. Document any issues found and fixes applied

## Success Criteria

The test is considered successful when:

- ✅ All unit tests pass with mock data
- ✅ Scout Worker generates valid extraction recipes
- ✅ Scrape Coordinator enqueues jobs correctly
- ✅ Scrape Events extracts events using recipes
- ✅ Process Worker normalizes events with correct quality scores
- ✅ Authentication prevents unauthorized access
- ✅ Rate limiting is enforced correctly
- ✅ Backoff logic works for failed rows
- ✅ Consecutive errors are tracked accurately
- ✅ No critical errors in error_logs
- ✅ Events appear in final `events` table with correct data

## Questions for User

1. Do you have a specific source ID you want to test with?
2. Are environment variables (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) configured?
3. Do you want to test with mock data first, or go straight to real sources?
4. Are there any specific aspects of the pipeline you're most concerned about?
