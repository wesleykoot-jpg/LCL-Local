# LCL Scraper Pipeline Analysis

## Executive Summary

The LCL scraper pipeline is a sophisticated, multi-stage event aggregation system designed to fetch, parse, normalize, and persist event data from various Dutch event sources. The architecture emphasizes resilience, fault tolerance, and graceful degradation through circuit breakers, rate limiting, and multiple fallback strategies.

---

## Architecture Overview

### Design Philosophy

The pipeline follows a **Data-First** architecture with these core principles:

1. **Isolation**: Each stage is independent. Stage N failure ≠ Stage N+1 failure
2. **Persistence**: Every intermediate result is saved. Restart = resume, not redo
3. **Circuit Breakers**: Failing sources are quarantined. Healthy sources keep running
4. **Dead Letter Queue**: Failed items go to DLQ. Manual inspection, auto-retry later
5. **Graceful Degradation**: AI unavailable? Use rule-based fallback. Geocoding down? Use source default coordinates
6. **Observability**: Every failure is logged with context. Slack alerts for patterns

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE EVENT PIPELINE: DISCOVERY → DISPLAY                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────┐                                                                    │
│  │   STAGE 1   │  SOURCE DISCOVERY                                                  │
│  │  (Weekly)   │  Find new event sources via Serper.dev + LLM validation           │
│  └──────┬──────┘                                                                    │
│         │ New sources added to `scraper_sources` (enabled=false, needs review)      │
│         ▼                                                                           │
│  ┌─────────────┐                                                                    │
│  │   STAGE 2   │  ORCHESTRATION                                                     │
│  │  (Daily)    │  Select healthy sources, apply circuit breakers, enqueue jobs     │
│  └──────┬──────┘                                                                    │
│         │ Jobs queued in `pipeline_jobs` with priority                              │
│         ▼                                                                           │
│  ┌─────────────┐                                                                    │
│  │   STAGE 3   │  FETCH                                                             │
│  │  (Workers)  │  Download HTML with retry, failover, rate limiting                │
│  └──────┬──────┘                                                                    │
│         │ Raw HTML saved to `raw_pages` table                                       │
│         ▼                                                                           │
│  ┌─────────────┐                                                                    │
│  │   STAGE 4   │  PARSE                                                             │
│  │  (Workers)  │  Extract event cards using selectors + JSON-LD                    │
│  └──────┬──────┘                                                                    │
│         │ Parsed events saved to `raw_events` table                                 │
│         ▼                                                                           │
│  ┌─────────────┐                                                                    │
│  │   STAGE 5   │  NORMALIZE & ENRICH                                                │
│  │  (Workers)  │  Date parsing, geocoding, categorization, AI enrichment           │
│  └──────┬──────┘                                                                    │
│         │ Enriched events saved to `staged_events` table                            │
│         ▼                                                                           │
│  ┌─────────────┐                                                                    │
│  │   STAGE 6   │  PERSIST                                                           │
│  │  (Workers)  │  Deduplicate, upsert to `events`, update stats                    │
│  └──────┬──────┘                                                                    │
│         │ Final events in `events` table with fingerprints                          │
│         ▼                                                                           │
│  ┌─────────────┐                                                                    │
│  │   STAGE 7   │  NOTIFY                                                            │
│  │  (Batched)  │  Slack summary, circuit breaker alerts, DLQ alerts                │
│  └──────┬──────┘                                                                    │
│         │                                                                           │
│         ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                              iOS APP DISPLAY                                 │   │
│  │  EventFeed.tsx → useEvents() → Supabase RPC → get_personalized_feed()       │   │
│  │  Feed algorithm ranks events by: distance, category match, social proof     │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
scraper_sources → pipeline_jobs → raw_pages → raw_events → staged_events → events
       ↑               ↑              ↑            ↑              ↑           ↑
       │               │              │            │              │           │
   DISCOVERY      ORCHESTRATE      FETCH        PARSE       NORMALIZE     PERSIST
```

---

## Core Components

### 1. Edge Functions

#### [`scrape-coordinator`](supabase/functions/scrape-coordinator/index.ts)
**Purpose**: Lightweight orchestrator that enqueues scrape jobs for available sources

**Key Features**:
- Volatility-based scheduling (15min - 24hr intervals)
- Circuit breaker filtering (skips OPEN state sources)
- Consecutive error tracking (threshold: 3)
- Automatic trigger of fetcher and processor workers
- Slack notifications for job queueing

**Configuration**:
```typescript
MIN_INTERVAL_MINUTES = 15
MAX_INTERVAL_MINUTES = 24 * 60
CIRCUIT_BREAKER_THRESHOLD = 3
```

**Logic Flow**:
1. Query enabled sources (not auto-disabled)
2. Filter by `next_scrape_at` schedule
3. Filter out sources with consecutive_errors >= 3 (unless cooldown passed)
4. Calculate `next_scrape_at` based on `volatility_score`
5. Enqueue jobs via `enqueue_scrape_jobs` RPC
6. Trigger `scrape-events` for each source (staggered by 100ms)
7. Trigger `process-worker` once
8. Update `consecutive_errors` for failed triggers

#### [`scrape-events`](supabase/functions/scrape-events/index.ts)
**Purpose**: Data-First fetcher that discovers event cards from source URLs

**Key Features**:
- Delta detection (SHA256 hash comparison)
- Pagination support (recursive with MAX_DEPTH=3)
- Multiple extraction strategies (JSON-LD, microdata, selectors, heuristics)
- Automatic failover to ScrapingBee
- Rate limiting and authentication middleware

**Logic Flow**:
1. Fetch source configuration from `scraper_sources`
2. Create appropriate fetcher (static/dynamic with failover)
3. Fetch HTML with timeout (45s)
4. Compare hash with `last_payload_hash` (skip if unchanged)
5. Parse listing using resolved strategy
6. Stage cards to `raw_event_staging` table
7. Update source state (hash, timestamp)
8. Recursively fetch pagination if `nextPageUrl` exists

**Supported Strategies**:
- `culture.ts` - Culture events
- `dining.ts` - Restaurant/food events
- `music.ts` - Music events
- `nightlife.ts` - Nightlife events
- `sports.ts` - Sports events

#### [`process-worker`](supabase/functions/process-worker/index.ts)
**Purpose**: Normalizes and enriches staged event data

**Key Features**:
- Batch processing (10 rows per claim)
- Hybrid parsing (waterfall: JSON-LD → AI fallback)
- Proactive detail page fetching
- Quality scoring (0-1 scale)
- Deduplication via fingerprints
- Exponential backoff retry logic

**Logic Flow**:
1. Claim pending rows from `raw_event_staging` via `claim_staging_rows` RPC
2. **Detail First**: Proactively fetch detail HTML if available
3. **Hybrid Parsing**:
   - Check for trusted methods (hydration, json_ld, microdata, feed)
   - Try JSON-LD extraction (fast path)
   - Try JSON-LD on detail HTML (waterfall)
   - AI parsing as fallback
4. Calculate quality score
5. Generate content hash and event fingerprint
6. Upsert to `events` table
7. Mark staging row as completed or failed with retry logic

**Quality Scoring** (0-1.0):
- Core fields (0.5): description, image, venue, location, date validity
- Enhanced fields (0.3): price, end_time, tickets_url, organizer
- Data richness (0.2): long description, venue address, performer

### 2. Shared Utilities

#### [`strategies.ts`](supabase/functions/_shared/strategies.ts)
**Purpose**: Page fetching abstraction with multiple strategies

**Fetcher Types**:
- `StaticPageFetcher` - Standard HTTP requests with user-agent spoofing
- `DynamicPageFetcher` - Headless browser (Puppeteer, Playwright, ScrapingBee)
- `FailoverPageFetcher` - Automatic failover (3 failures → switch to dynamic)

**Retry Configuration**:
```typescript
DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}
```

#### [`circuitBreaker.ts`](supabase/functions/_shared/circuitBreaker.ts)
**Purpose**: Circuit breaker pattern implementation for source health management

**States**:
- `CLOSED`: Normal operation, requests allowed
- `OPEN`: Circuit tripped, requests blocked (cooldown period)
- `HALF_OPEN`: Probing recovery, one request allowed

**Configuration**:
```typescript
DEFAULT_CONFIG = {
  failureThreshold: 5,
  successThreshold: 1,
  baseCooldownMs: 30 * 60 * 1000,  // 30 minutes
  maxCooldownMs: 24 * 60 * 60 * 1000,  // 24 hours
}
```

**Key Functions**:
- `isCircuitClosed()` - Check if requests allowed
- `recordSuccess()` - Record successful request
- `recordFailure()` - Record failed request, may open circuit
- `resetCircuit()` - Manual reset to CLOSED state
- `getAvailableSources()` - Get all non-blocked sources
- `getSourcesByPriority()` - Get sources ordered by priority score

#### [`rateLimiting.ts`](supabase/functions/_shared/rateLimiting.ts)
**Purpose**: Rate limiting utilities with anti-fingerprinting jitter

**Features**:
- Jittered delays (±20% by default)
- Anti-fingerprinting through randomized delays
- Rate limit detection (403, 429 status codes)

#### [`types.ts`](supabase/functions/_shared/types.ts)
**Purpose**: Canonical type definitions for the entire pipeline

**Key Types**:
- `RawEventCard` - Parsed event card (before normalization)
- `NormalizedEvent` - Structured event ready for database
- `EnrichedEvent` - Final event with all fields
- `ScraperSource` - Source configuration
- `PipelineJob` - Job tracking across stages
- `CircuitBreakerState` - Circuit breaker state
- `DeadLetterItem` - Failed items for manual review

**Category Keys**:
```typescript
type CategoryKey = 
  | 'MUSIC' | 'SOCIAL' | 'ACTIVE' | 'CULTURE' | 'FOOD'
  | 'NIGHTLIFE' | 'FAMILY' | 'CIVIC' | 'COMMUNITY';
```

---

## Database Schema

### Core Tables

#### `scraper_sources`
Source configuration and health tracking

**Key Columns**:
- `id` (UUID) - Primary key
- `name` (TEXT) - Source name
- `url` (TEXT) - Source URL
- `enabled` (BOOLEAN) - Whether source is active
- `auto_disabled` (BOOLEAN) - Auto-disabled by system
- `consecutive_errors` (INTEGER) - Consecutive failure count
- `volatility_score` (FLOAT) - 0-1 score for scheduling
- `last_scraped_at` (TIMESTAMPTZ) - Last successful scrape
- `next_scrape_at` (TIMESTAMPTZ) - Next scheduled scrape
- `last_payload_hash` (TEXT) - Delta detection hash
- `total_savings_prevented_runs` (INTEGER) - Runs skipped by delta detection
- `config` (JSONB) - Per-source configuration
- `fetcher_type` (TEXT) - 'static' | 'puppeteer' | 'playwright' | 'scrapingbee'
- `tier` (TEXT) - 'aggregator' | 'venue' | 'general'
- `preferred_method` (TEXT) - Extraction method preference

#### `raw_event_staging`
Staging table for discovered event cards

**Key Columns**:
- `id` (UUID) - Primary key
- `source_id` (UUID) - FK to scraper_sources
- `source_url` (TEXT) - Detail page URL
- `raw_html` (TEXT) - Raw HTML or JSON payload
- `detail_html` (TEXT) - Fetched detail page HTML
- `status` (TEXT) - 'pending' | 'completed' | 'failed' | 'pending_with_backoff'
- `parsing_method` (TEXT) - Method used for extraction
- `retry_count` (INTEGER) - Retry attempt count
- `error_message` (TEXT) - Last error message
- `updated_at` (TIMESTAMPTZ) - Last update (used for backoff)

#### `events`
Final normalized events

**Key Columns**:
- `id` (UUID) - Primary key
- `title` (TEXT) - Event title
- `description` (TEXT) - Event description
- `event_date` (DATE) - Event date
- `event_time` (TEXT) - Event time (HH:MM or 'TBD')
- `venue_name` (TEXT) - Venue name
- `location` (GEOGRAPHY) - PostGIS POINT
- `category` (TEXT) - Event category key
- `image_url` (TEXT) - Event image
- `source_id` (UUID) - FK to scraper_sources
- `event_fingerprint` (TEXT) - Deduplication fingerprint
- `content_hash` (TEXT) - Content hash for deduplication
- `quality_score` (FLOAT) - 0-1 quality score
- `data_completeness` (FLOAT) - 0-1 completeness score

#### `circuit_breaker_state`
Circuit breaker state persistence

**Key Columns**:
- `source_id` (UUID) - FK to scraper_sources
- `state` (TEXT) - 'CLOSED' | 'OPEN' | 'HALF_OPEN'
- `failure_count` (INTEGER) - Total failures
- `success_count` (INTEGER) - Total successes
- `consecutive_opens` (INTEGER) - Times circuit opened
- `cooldown_until` (TIMESTAMPTZ) - When to allow requests
- `opened_at` (TIMESTAMPTZ) - When circuit opened
- `last_failure_at` (TIMESTAMPTZ) - Last failure
- `last_success_at` (TIMESTAMPTZ) - Last success

### Database Views

#### `source_health_status`
Combined health view for source selection

**Columns**: All `scraper_sources` columns plus:
- `circuit_state` - Circuit breaker state
- `circuit_failure_count` - Circuit failure count
- `circuit_success_count` - Circuit success count
- `cooldown_until` - Circuit cooldown expiry
- `is_available` - Boolean (circuit not blocking)
- `priority_score` - Calculated priority for ordering

### RPC Functions

- `claim_staging_rows(p_batch_size)` - Atomically claim pending staging rows
- `enqueue_scrape_jobs(p_jobs)` - Enqueue scrape jobs
- `cb_record_success(p_source_id)` - Record circuit breaker success
- `cb_record_failure(p_source_id, p_error_message, p_failure_threshold)` - Record circuit breaker failure
- `cb_check_cooldown()` - Check and transition OPEN → HALF_OPEN
- `increment_source_errors(p_source_ids)` - Increment consecutive_errors for sources

---

## Resilience Patterns

### 1. Circuit Breaker Pattern

**Purpose**: Prevent cascading failures from repeatedly calling failing sources

**Implementation**:
- State persisted in `circuit_breaker_state` table
- Automatic transition: CLOSED → OPEN (5 failures) → HALF_OPEN (cooldown) → CLOSED (success)
- Cooldown with exponential backoff (30min base, 24hr max)
- Manual reset capability via `resetCircuit()`

**Usage**:
```typescript
if (!await isCircuitClosed(supabaseUrl, supabaseKey, sourceId)) {
  // Skip this source
  continue;
}

try {
  const result = await fetchSource(sourceId);
  await recordSuccess(supabaseUrl, supabaseKey, sourceId);
} catch (error) {
  const { circuitOpened } = await recordFailure(supabaseUrl, supabaseKey, sourceId, error.message);
  if (circuitOpened) {
    // Alert operator
  }
}
```

### 2. Retry with Exponential Backoff

**Purpose**: Handle transient failures gracefully

**Implementation**:
```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    ...config,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

### 3. Failover Fetching

**Purpose**: Automatically switch to more robust fetching when static fails

**Implementation**:
```typescript
class FailoverPageFetcher implements PageFetcher {
  private failureCount = 0;
  private maxFailuresBeforeFailover = 3;
  private hasFailedOver = false;

  async fetchPage(url: string) {
    if (this.hasFailedOver && this.dynamicFetcher) {
      return await this.dynamicFetcher.fetchPage(url);
    }

    try {
      const result = await this.staticFetcher.fetchPage(url);
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      
      if (this.failureCount >= this.maxFailuresBeforeFailover && 
          this.dynamicFetcher && !this.hasFailedOver) {
        this.hasFailedOver = true;
        return await this.dynamicFetcher.fetchPage(url);
      }
      
      throw error;
    }
  }
}
```

### 4. Delta Detection

**Purpose**: Skip processing unchanged pages to save resources

**Implementation**:
```typescript
const currentHash = await sha256Hex(html);
if (depth === 0 && lastHash === currentHash && !overrideUrl) {
  console.log(`Source ${sourceId}: Listing HTML unchanged (Delta Skip)`);
  await supabase
    .from("scraper_sources")
    .update({ 
      last_scraped_at: new Date().toISOString(),
      total_savings_prevented_runs: (currentRuns + 1)
    })
    .eq("id", sourceId);
  return { status: "skipped_unchanged" };
}
```

### 5. Dead Letter Queue

**Purpose**: Capture failed items for manual inspection and retry

**Implementation**:
- Failed items moved to DLQ table with error context
- Retry count tracking (max 3 by default)
- Exponential backoff for retries
- Manual resolution workflow

### 6. Graceful Degradation

**Purpose**: Continue operation when optional components fail

**Examples**:
- AI parsing fails → Use rule-based fallback
- Geocoding fails → Use source default coordinates
- Detail page fetch fails → Use listing data
- Image extraction fails → Set to null, continue processing

---

## Configuration

### Source Configuration

Per-source configuration stored in `scraper_sources.config` JSONB:

```typescript
{
  // Rate limiting
  rate_limit_ms: 1000,
  dynamic_rate_limit_ms: null,
  rate_limit_expires_at: null,
  
  // Fetching
  headers: { "User-Agent": "..." },
  requires_render: false,
  scrapingbee_api_key: "...",
  headless: true,
  wait_for_selector: ".event-list",
  wait_for_timeout: 10000,
  
  // Extraction
  selectors: [".event-card", ".event-title"],
  preferred_method: "auto",  // 'hydration' | 'json_ld' | 'microdata' | 'feed' | 'dom' | 'auto'
  deep_scrape_enabled: true,
  
  // Location
  default_coordinates: { lat: 52.5, lng: 4.9 },
  language: "nl",
  country: "NL",
  
  // Discovery
  discoveryAnchors: ["agenda", "evenementen"],
  alternatePaths: ["/events", "/calendar"],
  feed_discovery: true,
}
```

### Environment Variables

Required environment variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `SCRAPINGBEE_API_KEY` - Optional: ScrapingBee API key
- `SLACK_WEBHOOK_URL` - Optional: Slack webhook for alerts

---

## Observability

### Logging

**Structured Logging**:
- All edge functions use structured logging with context
- Error logging via [`errorLogging.ts`](supabase/functions/_shared/errorLogging.ts)
- Supabase error logging with `logSupabaseError()`

**Log Levels**:
- `console.log()` - Normal operation
- `console.warn()` - Recoverable issues
- `console.error()` - Critical failures

### Slack Notifications

**Alert Types**:
1. **Scrape Coordinator**: Job queueing summary
2. **Circuit Breaker**: Source circuit opened
3. **DLQ**: Items moved to dead letter queue
4. **Pipeline**: Critical failures

**Notification Format**:
```typescript
await sendSlackNotification(
  `🚀 Scrape Coordinator: queued ${jobsCreated} jobs for ${eligibleSources.length} sources`,
  false  // isCritical
);
```

### Health Checks

**Pipeline Health**:
- [`check_pipeline_health.ts`](check_pipeline_health.ts) - Overall pipeline health
- [`health_check_coordinator.ts`](scripts/health_check_coordinator.ts) - Coordinator health
- [`health_check_fetcher.ts`](scripts/health_check_fetcher.ts) - Fetcher health
- [`health_check_worker.ts`](scripts/health_check_worker.ts) - Worker health

**Metrics Tracked**:
- Source health status (by circuit breaker state)
- Job queue depth
- Processing time per stage
- Error rates by stage
- Delta detection savings

---

## Operational Procedures

### Manual Triggering

**Via Admin UI** ([`SCRAPER_PIPELINE_CONTROL.md`](docs/scraper/SCRAPER_PIPELINE_CONTROL.md)):
1. Navigate to `/admin`
2. Select sources (All, Enabled, Broken, or manual)
3. Choose operation:
   - **Run Selected Sources** - Immediate synchronous execution
   - **Queue Selected Sources** - Async background processing
   - **Trigger run-scraper** - Alternative scraper implementation
   - **Retry Failed Jobs** - Reset failed jobs to pending

**Via Edge Functions**:
```bash
# Trigger coordinator
curl -X POST https://<project-ref>.supabase.co/functions/v1/scrape-coordinator \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceIds": ["uuid1", "uuid2"], "triggerWorker": true}'

# Trigger specific source
curl -X POST https://<project-ref>.supabase.co/functions/v1/scrape-events \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "source-uuid"}'
```

### Troubleshooting

**Common Issues** (from [`RUNBOOK.md`](docs/scraper/RUNBOOK.md)):

| Issue | Symptoms | Response |
|-------|----------|----------|
| HTTP 5xx | Repeated 500/502/503/504 | Wait, check target site, adjust rate limits |
| HTTP 429 | Rate limiting | Verify robots.txt, reduce request rate |
| Timeout | Null status, timeout errors | Check accessibility, increase timeout |
| Parsing errors | Parse/schema errors | Compare HTML, update parser, dry-run |
| Robots.txt blocking | "Disallowed by robots.txt" | Check robots.txt, request permission, remove source |

**Manual Interventions**:
```sql
-- Reset consecutive failures
UPDATE scraper_sources 
SET consecutive_errors = 0, 
    note = 'Manually reset - issue resolved'
WHERE id = 'your-source-id';

-- Temporarily disable source
UPDATE scraper_sources 
SET enabled = false,
    notes = 'Temporarily disabled - issue being investigated'
WHERE id = 'your-source-id';

-- Reset circuit breaker
UPDATE circuit_breaker_state
SET state = 'CLOSED',
    failure_count = 0,
    success_count = 0,
    consecutive_opens = 0,
    cooldown_until = NULL,
    opened_at = NULL
WHERE source_id = 'your-source-id';
```

### Monitoring

**Key Metrics to Monitor**:
1. **Source Health**: Circuit breaker states, consecutive errors
2. **Job Queue**: Pending jobs, processing time, failure rate
3. **Event Quality**: Average quality score, completeness
4. **Delta Detection**: Runs saved, hash comparisons
5. **Error Patterns**: Common error messages, failing sources

**Dashboard Queries**:
```sql
-- Source health summary
SELECT 
  state,
  COUNT(*) as count
FROM circuit_breaker_state
GROUP BY state;

-- Job queue depth
SELECT 
  status,
  COUNT(*) as count
FROM raw_event_staging
GROUP BY status;

-- Event quality distribution
SELECT 
  category,
  AVG(quality_score) as avg_quality,
  COUNT(*) as event_count
FROM events
WHERE event_date >= CURRENT_DATE
GROUP BY category
ORDER BY avg_quality DESC;

-- Delta detection savings
SELECT 
  SUM(total_savings_prevented_runs) as total_saved_runs,
  AVG(total_savings_prevented_runs) as avg_saved_per_source
FROM scraper_sources
WHERE total_savings_prevented_runs > 0;
```

---

## Strengths

1. **Resilient Architecture**: Multiple layers of fault tolerance (circuit breakers, retries, failover)
2. **Data-First Design**: Separation of fetching and processing enables parallel execution
3. **Observability**: Comprehensive logging, health checks, and Slack alerts
4. **Graceful Degradation**: System continues operating when optional components fail
5. **Delta Detection**: Significant resource savings by skipping unchanged pages
6. **Flexible Configuration**: Per-source configuration allows fine-tuning
7. **Manual Control**: Admin UI provides manual override and troubleshooting capabilities
8. **Quality Scoring**: Data quality tracking enables filtering and prioritization
9. **Hybrid Parsing**: Multiple extraction strategies with AI fallback
10. **Dead Letter Queue**: Failed items preserved for inspection and retry

---

## Potential Improvements

### 1. Performance

**Issue**: Sequential processing of sources in coordinator
**Impact**: Limits throughput for large source sets
**Suggestion**: Implement parallel processing with concurrency limits

**Issue**: Batch size fixed at 10 in process-worker
**Impact**: May not be optimal for all workloads
**Suggestion**: Make batch size configurable based on event complexity

### 2. Scalability

**Issue**: Edge function timeout (45s) limits deep pagination
**Impact**: May miss events on large paginated listings
**Suggestion**: Implement checkpoint-based pagination with resume capability

**Issue**: No horizontal scaling for workers
**Impact**: Single worker instance may become bottleneck
**Suggestion**: Implement worker pool with load balancing

### 3. Data Quality

**Issue**: Quality scoring is heuristic-based
**Impact**: May not accurately reflect user-perceived quality
**Suggestion**: Incorporate user feedback (clicks, saves) into quality scoring

**Issue**: Limited deduplication (fingerprint + content hash)
**Impact**: May miss duplicates across different sources
**Suggestion**: Implement cross-source deduplication using semantic similarity

### 4. Observability

**Issue**: No centralized metrics dashboard
**Impact**: Difficult to track trends and anomalies
**Suggestion**: Integrate with Prometheus/Grafana for metrics visualization

**Issue**: Logs scattered across edge functions
**Impact**: Difficult to trace end-to-end request flow
**Suggestion**: Implement distributed tracing (e.g., OpenTelemetry)

### 5. Error Handling

**Issue**: Limited error classification
**Impact**: Hard to identify patterns and root causes
**Suggestion**: Implement error taxonomy with automatic classification

**Issue**: No alert suppression for known issues
**Impact**: Alert fatigue from recurring false positives
**Suggestion**: Implement alert deduplication and suppression rules

### 6. Source Discovery

**Issue**: Manual source addition required
**Impact**: Missed sources, manual overhead
**Suggestion**: Enhance automated discovery with broader search patterns

**Issue**: No source validation before addition
**Impact**: May add low-quality or irrelevant sources
**Suggestion**: Implement source quality scoring during discovery

### 7. Rate Limiting

**Issue**: Rate limiting is source-specific, not domain-wide
**Impact**: May trigger rate limits when scraping multiple sources from same domain
**Suggestion**: Implement domain-wide rate limiting with shared quotas

**Issue**: No adaptive rate limiting based on response times
**Impact**: May be too aggressive or too conservative
**Suggestion**: Implement adaptive rate limiting based on server response

### 8. Testing

**Issue**: Limited automated testing
**Impact**: Regression risk when making changes
**Suggestion**: Implement integration tests for all pipeline stages

**Issue**: No performance benchmarking
**Impact**: Difficult to detect performance regressions
**Suggestion**: Implement performance benchmarking suite

---

## Security Considerations

1. **Authentication**: Edge functions protected with auth middleware
2. **Rate Limiting**: Server-side rate limiting prevents abuse
3. **Secrets Management**: API keys stored in environment variables
4. **Input Validation**: All inputs validated before processing
5. **SQL Injection**: Parameterized queries via Supabase client
6. **CORS**: Proper CORS headers configured
7. **User Agent Spoofing**: Mimics browser behavior to avoid detection

---

## Dependencies

### External Services

- **Supabase**: Database, edge functions, authentication
- **ScrapingBee**: Headless browser service (optional)
- **Serper.dev**: Search API for source discovery (optional)
- **Slack**: Alert notifications (optional)
- **AI Service**: For event parsing and enrichment (Gemini API)

### NPM Packages

- `@supabase/supabase-js@2.49.1` - Supabase client
- `cheerio@1.0.0-rc.12` - HTML parsing
- `puppeteer@23.11.1` - Headless browser (optional)
- `playwright@1.49.1` - Headless browser (optional)

### Deno Modules

- `https://deno.land/std@0.168.0/http/server.ts` - HTTP server

---

## Conclusion

The LCL scraper pipeline is a well-architected, resilient system for event aggregation. The multi-stage design with isolation, persistence, and fault tolerance ensures reliable operation even when individual components fail. The circuit breaker pattern, retry logic, and failover mechanisms provide robust error handling.

Key strengths include:
- Comprehensive observability and monitoring
- Flexible configuration per source
- Manual control via admin UI
- Quality scoring and data completeness tracking
- Hybrid parsing with AI fallback

Areas for improvement include:
- Performance optimization (parallel processing, configurable batch sizes)
- Enhanced observability (centralized metrics, distributed tracing)
- Better error handling (classification, alert suppression)
- Scalability improvements (horizontal scaling, checkpoint-based pagination)
- Data quality enhancements (user feedback integration, cross-source deduplication)

Overall, the pipeline demonstrates solid engineering practices and provides a strong foundation for a production event aggregation system.
