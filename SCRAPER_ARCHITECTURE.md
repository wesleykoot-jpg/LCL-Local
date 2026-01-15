# LCL Scraper Architecture v2.0

## Intelligent, Non-Breaking, Resilient Event Pipeline

> **Design Goal**: Zero-stoppage architecture from source discovery to event card display.
> Every stage can fail gracefully without bringing down the pipeline.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [End-to-End Pipeline Overview](#end-to-end-pipeline-overview)
3. [Stage 1: Source Discovery](#stage-1-source-discovery)
4. [Stage 2: Orchestration](#stage-2-orchestration)
5. [Stage 3: Fetch](#stage-3-fetch)
6. [Stage 4: Parse](#stage-4-parse)
7. [Stage 5: Normalize & Enrich](#stage-5-normalize--enrich)
8. [Stage 6: Persist](#stage-6-persist)
9. [Stage 7: Notify](#stage-7-notify)
10. [Resilience Patterns](#resilience-patterns)
11. [Database Schema](#database-schema)
12. [Shared Utilities (Canonical)](#shared-utilities-canonical)
13. [iOS Integration](#ios-integration)
14. [Migration Guide](#migration-guide)
15. [Operational Runbook](#operational-runbook)

---

## Executive Summary

### The Problem

The current scraper has these failure modes that cause **full pipeline stoppages**:

| Failure Mode | Current Behavior | Impact |
|--------------|------------------|--------|
| Source returns 403 | Entire scrape run slows down | 🔴 Full slowdown |
| Gemini API rate limit | AI enrichment fails, events discarded | 🔴 Data loss |
| Database connection drops | Job marked failed, no retry | 🔴 Data loss |
| Edge function timeout | Partial work lost | 🔴 Inconsistent state |
| Malformed HTML | Parse exception stops source | 🟡 Source skipped |

### The Solution: Intelligent Non-Breaking Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        RESILIENT PIPELINE PRINCIPLES                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  1. ISOLATION     Each stage is independent. Stage N failure ≠ Stage N+1 failure   │
│                                                                                      │
│  2. PERSISTENCE   Every intermediate result is saved. Restart = resume, not redo   │
│                                                                                      │
│  3. CIRCUIT       Failing sources are quarantined. Healthy sources keep running    │
│     BREAKERS                                                                        │
│                                                                                      │
│  4. DEAD LETTER   Failed items go to DLQ. Manual inspection, auto-retry later      │
│     QUEUE                                                                           │
│                                                                                      │
│  5. GRACEFUL      AI unavailable? Use rule-based fallback. Geocoding down? Use     │
│     DEGRADATION   source default coordinates.                                       │
│                                                                                      │
│  6. OBSERVABILITY Every failure is logged with context. Slack alerts for patterns  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Pipeline Overview

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

### Data Flow Between Stages

```
scraper_sources → pipeline_jobs → raw_pages → raw_events → staged_events → events
       ↑               ↑              ↑            ↑              ↑           ↑
       │               │              │            │              │           │
   DISCOVERY      ORCHESTRATE      FETCH        PARSE       NORMALIZE     PERSIST
```

Each arrow represents a **checkpoint**. If any stage fails:
- Previous stage's output is preserved
- Failed item goes to DLQ
- Pipeline continues with remaining items
- Auto-retry happens in next run

---

## Stage 1: Source Discovery

### Purpose
Automatically find new event sources across Dutch municipalities without manual research.

### Trigger
- **Weekly** cron job (Sunday 3 AM)
- Manual trigger for new regions

### Edge Function: `source-discovery-orchestrator`

```typescript
// Responsibilities:
// 1. Select municipalities that haven't been searched recently
// 2. Enqueue discovery jobs with population-based priority
// 3. Trigger discovery workers

interface DiscoveryJob {
  municipality: string;
  population: number;
  coordinates: { lat: number; lng: number };
  search_queries: string[];  // Pre-generated queries
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

### Edge Function: `source-discovery-worker`

```typescript
// Responsibilities:
// 1. Execute Serper.dev searches (5 queries per municipality)
// 2. Filter noise domains (tripadvisor, facebook, etc.)
// 3. Validate candidates with LLM (is this an event agenda?)
// 4. Insert validated sources with confidence score

// Resilience features:
// - Serper API failure → Skip municipality, retry next week
// - LLM failure → Use heuristic validation (keyword matching)
// - Database failure → Write to local file, alert for manual import
```

### Resilience: Discovery

| Failure | Fallback | Recovery |
|---------|----------|----------|
| Serper.dev down | Use cached results from last successful run | Auto-retry next week |
| Serper rate limit | Exponential backoff, continue with remaining queries | Resume from checkpoint |
| LLM validation fails | Heuristic validation (check for date patterns, event keywords) | Flag for manual review |
| Candidate URL unreachable | Skip, don't add to sources | Log for analysis |

---

## Stage 2: Orchestration

### Purpose
Intelligently select which sources to scrape, respecting health status and rate limits.

### Trigger
- **Daily** cron job (6 AM)
- Manual trigger for immediate scrape

### Edge Function: `scrape-orchestrator`

```typescript
// Responsibilities:
// 1. Query source_health_status view (combines circuit breaker + rate limits)
// 2. Filter out sources in OPEN circuit state
// 3. Filter out sources in rate limit cooldown
// 4. Prioritize sources by: last_success_at, historical_event_count, reliability_score
// 5. Enqueue jobs to pipeline_jobs table
// 6. Spawn workers (1 per 10 jobs, max 10 workers)

async function selectSourcesForScraping(): Promise<ScraperSource[]> {
  const { data: sources } = await supabase
    .from('source_health_status')
    .select('*')
    .eq('is_available', true)      // Circuit not OPEN
    .eq('enabled', true)
    .order('priority_score', { ascending: false });
  
  return sources;
}

// Priority score calculation (in database view):
// priority_score = 
//   (days_since_last_scrape * 10) +
//   (historical_event_count / 10) +
//   (reliability_score * 5) -
//   (consecutive_failures * 20)
```

### Job Enqueueing

```sql
-- Pipeline jobs table with stage tracking
CREATE TABLE pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES scraper_sources(id),
  run_id UUID NOT NULL,  -- Groups jobs from same orchestration run
  
  -- Stage progression
  current_stage TEXT DEFAULT 'fetch',
  stage_status JSONB DEFAULT '{
    "fetch": "pending",
    "parse": "pending", 
    "normalize": "pending",
    "persist": "pending"
  }',
  
  -- Retry tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Priority (higher = processed first)
  priority INTEGER DEFAULT 0
);

-- Index for worker job claiming
CREATE INDEX idx_pipeline_jobs_pending 
  ON pipeline_jobs(priority DESC, created_at ASC) 
  WHERE current_stage != 'completed' AND current_stage != 'dead_letter';
```

---

## Stage 3: Fetch

### Purpose
Download HTML from source URLs with intelligent retry and failover.

### Edge Function: `fetch-worker`

```typescript
// Responsibilities:
// 1. Claim a job from pipeline_jobs where current_stage = 'fetch'
// 2. Check proactive rate limit (can we make a request now?)
// 3. Fetch HTML using appropriate PageFetcher (static/dynamic)
// 4. Save HTML to raw_pages table
// 5. Advance job to parse stage or move to DLQ

interface FetchResult {
  success: boolean;
  html?: string;
  finalUrl?: string;
  statusCode?: number;
  fetchDurationMs?: number;
  fetcherUsed: 'static' | 'scrapingbee';
  error?: string;
}

async function fetchWithResilience(source: ScraperSource): Promise<FetchResult> {
  // 1. Check proactive rate limit
  const canRequest = await canMakeRequest(source.id);
  if (!canRequest.allowed) {
    return { 
      success: false, 
      error: `Rate limited, wait ${canRequest.waitMs}ms` 
    };
  }
  
  // 2. Try primary fetcher
  const fetcher = createFetcherForSource(source);
  try {
    const result = await fetcher.fetchPage(source.url);
    
    // 3. Record success for circuit breaker
    await recordSuccess(source.id);
    
    return { success: true, ...result, fetcherUsed: 'static' };
  } catch (primaryError) {
    // 4. Try fallback fetcher (ScrapingBee)
    if (source.fetcher_type !== 'scrapingbee') {
      try {
        const fallback = new ScrapingBeeFetcher();
        const result = await fallback.fetchPage(source.url);
        
        // Recommend fetcher upgrade
        await suggestFetcherUpgrade(source.id, 'scrapingbee');
        
        return { success: true, ...result, fetcherUsed: 'scrapingbee' };
      } catch (fallbackError) {
        // Both failed
        await recordFailure(source.id, fallbackError.message);
        return { success: false, error: fallbackError.message };
      }
    }
    
    await recordFailure(source.id, primaryError.message);
    return { success: false, error: primaryError.message };
  }
}
```

### Raw Pages Table

```sql
CREATE TABLE raw_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id),
  source_id UUID REFERENCES scraper_sources(id),
  url TEXT NOT NULL,
  final_url TEXT,  -- After redirects
  html TEXT,
  status_code INTEGER,
  fetcher_used TEXT,
  fetch_duration_ms INTEGER,
  content_hash TEXT,  -- For detecting unchanged pages
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detect unchanged pages (skip re-parsing)
CREATE INDEX idx_raw_pages_content_hash ON raw_pages(source_id, content_hash);
```

### Resilience: Fetch

| Failure | Fallback | Recovery |
|---------|----------|----------|
| HTTP 403/429 | Try ScrapingBee | Record in circuit breaker, extend cooldown |
| Timeout | Retry with 2x timeout | After 3 retries, move to DLQ |
| DNS failure | Skip source | Alert, check if domain changed |
| SSL error | Skip source | Alert for manual investigation |
| ScrapingBee quota exceeded | Use cached page if < 24h old | Alert for quota increase |

---

## Stage 4: Parse

### Purpose
Extract structured event cards from raw HTML.

### Edge Function: `parse-worker`

```typescript
// Responsibilities:
// 1. Claim jobs where current_stage = 'parse'
// 2. Load HTML from raw_pages
// 3. Try multiple extraction strategies in order
// 4. Save parsed events to raw_events
// 5. Advance job or move to DLQ

interface ParseStrategy {
  name: string;
  priority: number;
  canHandle(html: string): boolean;
  parse(html: string, source: ScraperSource): RawEventCard[];
}

const PARSE_STRATEGIES: ParseStrategy[] = [
  { name: 'json-ld', priority: 1, ... },      // Best: structured data
  { name: 'microdata', priority: 2, ... },    // Good: schema.org markup
  { name: 'selectors', priority: 3, ... },    // Fallback: CSS selectors
  { name: 'heuristic', priority: 4, ... },    // Last resort: pattern matching
];

async function parseWithFallback(html: string, source: ScraperSource): Promise<RawEventCard[]> {
  for (const strategy of PARSE_STRATEGIES) {
    if (strategy.canHandle(html)) {
      try {
        const events = strategy.parse(html, source);
        if (events.length > 0) {
          console.log(`Parsed ${events.length} events using ${strategy.name}`);
          return events;
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
        // Continue to next strategy
      }
    }
  }
  
  // No events found - this might be okay (empty agenda) or broken selectors
  return [];
}
```

### Raw Events Table

```sql
CREATE TABLE raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id),
  source_id UUID REFERENCES scraper_sources(id),
  page_id UUID REFERENCES raw_pages(id),
  
  -- Raw extracted data (before normalization)
  raw_title TEXT,
  raw_date TEXT,
  raw_time TEXT,
  raw_location TEXT,
  raw_description TEXT,
  detail_url TEXT,
  image_url TEXT,
  raw_html TEXT,  -- The specific HTML block for this event
  
  -- Extraction metadata
  parse_strategy TEXT,  -- Which strategy extracted this
  confidence_score FLOAT,
  
  -- Processing status
  status TEXT DEFAULT 'pending',  -- pending, normalized, failed
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Resilience: Parse

| Failure | Fallback | Recovery |
|---------|----------|----------|
| Primary selectors fail | Try JSON-LD, then microdata, then heuristics | Log selector drift, suggest update |
| 0 events parsed | Check if page structure changed | Compare with last successful HTML |
| Malformed HTML | Use lenient parser (cheerio handles this) | Log for analysis |
| Memory limit (huge page) | Truncate to first 500KB | Log, consider pagination |

---

## Stage 5: Normalize & Enrich

### Purpose
Transform raw event data into structured, consistent format.

### Edge Function: `normalize-worker`

```typescript
// Responsibilities:
// 1. Claim raw_events where status = 'pending'
// 2. Parse dates (handle Dutch formats, relative dates)
// 3. Geocode locations (with caching)
// 4. Classify categories
// 5. Optionally enrich with AI (batched)
// 6. Save to staged_events

interface NormalizeResult {
  title: string;
  description: string;
  event_date: string;  // ISO 8601
  event_time: string;  // HH:MM or 'TBD'
  structured_date: StructuredDate;
  structured_location: StructuredLocation;
  category: InternalCategory;
  venue_name: string;
  image_url: string | null;
  confidence_score: number;
  normalization_method: 'rules' | 'ai' | 'hybrid';
}

async function normalizeEvent(raw: RawEventCard, source: ScraperSource): Promise<NormalizeResult | null> {
  // 1. Parse date (required)
  const parsedDate = parseToISODate(raw.raw_date);
  if (!parsedDate) {
    // Try AI extraction as fallback
    if (GEMINI_AVAILABLE) {
      const aiDate = await extractDateWithAI(raw.raw_html);
      if (!aiDate) return null;  // Can't determine date, skip event
    }
    return null;
  }
  
  // 2. Geocode location (with graceful degradation)
  let location: StructuredLocation;
  try {
    location = await geocodeLocation(raw.raw_location, source.default_coordinates);
  } catch {
    // Geocoding failed, use source default
    location = {
      name: raw.raw_location || source.name,
      coordinates: source.default_coordinates
    };
  }
  
  // 3. Classify category (never fails, has default)
  const category = classifyTextToCategory(
    `${raw.raw_title} ${raw.raw_description}`
  );
  
  // 4. AI enrichment (optional, batched for efficiency)
  let enriched = null;
  if (shouldEnrichWithAI(raw)) {
    try {
      enriched = await batchEnrichWithAI([raw]);
    } catch {
      // AI unavailable, continue without enrichment
      console.warn('AI enrichment skipped, continuing with rules-based');
    }
  }
  
  return {
    title: normalizeWhitespace(enriched?.title || raw.raw_title),
    description: enriched?.description || raw.raw_description || '',
    event_date: parsedDate,
    // ... rest of normalization
    normalization_method: enriched ? 'ai' : 'rules'
  };
}
```

### Staged Events Table

```sql
CREATE TABLE staged_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id),
  source_id UUID REFERENCES scraper_sources(id),
  raw_event_id UUID REFERENCES raw_events(id),
  
  -- Normalized data (ready for events table)
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  event_time TEXT,
  venue_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  category TEXT,
  image_url TEXT,
  
  -- Structured fields
  structured_date JSONB,
  structured_location JSONB,
  
  -- Deduplication
  event_fingerprint TEXT NOT NULL,
  
  -- Quality metrics
  confidence_score FLOAT,
  normalization_method TEXT,
  
  -- Processing status
  status TEXT DEFAULT 'pending',  -- pending, persisted, duplicate, failed
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for deduplication check
CREATE UNIQUE INDEX idx_staged_events_fingerprint 
  ON staged_events(source_id, event_fingerprint) 
  WHERE status = 'pending';
```

### Resilience: Normalize

| Failure | Fallback | Recovery |
|---------|----------|----------|
| Date parsing fails | Try AI extraction | If both fail, skip event (can't display without date) |
| Geocoding API down | Use source default coordinates | Flag for re-geocoding later |
| Gemini rate limit | Use rules-based normalization | Enrich in next batch |
| Gemini returns garbage | Discard AI result, use rules-based | Log for prompt tuning |
| Category unknown | Default to 'community' | Works for display |

---

## Stage 6: Persist

### Purpose
Write validated events to the final `events` table with deduplication.

### Edge Function: `persist-worker`

```typescript
// Responsibilities:
// 1. Claim staged_events where status = 'pending'
// 2. Check for duplicates (same fingerprint in events table)
// 3. Upsert events (insert or update if fingerprint exists)
// 4. Update source statistics
// 5. Update circuit breaker (success)

async function persistEvent(staged: StagedEvent): Promise<PersistResult> {
  // 1. Check for existing event with same fingerprint
  const { data: existing } = await supabase
    .from('events')
    .select('id, updated_at')
    .eq('event_fingerprint', staged.event_fingerprint)
    .eq('source_id', staged.source_id)
    .single();
  
  if (existing) {
    // Event exists - check if update needed
    if (eventHasChanges(existing, staged)) {
      await supabase
        .from('events')
        .update({
          title: staged.title,
          description: staged.description,
          // ... other fields
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      return { action: 'updated', eventId: existing.id };
    }
    
    return { action: 'skipped', reason: 'no_changes' };
  }
  
  // 2. Insert new event
  const { data: inserted, error } = await supabase
    .from('events')
    .insert({
      title: staged.title,
      description: staged.description,
      event_date: staged.event_date,
      event_time: staged.event_time,
      venue_name: staged.venue_name,
      location: staged.location,
      category: staged.category,
      event_type: 'anchor',
      source_id: staged.source_id,
      event_fingerprint: staged.event_fingerprint,
      structured_date: staged.structured_date,
      structured_location: staged.structured_location,
      status: 'published'
    })
    .select('id')
    .single();
  
  if (error) {
    // Handle constraint violations gracefully
    if (error.code === '23505') {  // Unique violation
      return { action: 'skipped', reason: 'duplicate' };
    }
    throw error;
  }
  
  return { action: 'inserted', eventId: inserted.id };
}
```

### Resilience: Persist

| Failure | Fallback | Recovery |
|---------|----------|----------|
| Database connection lost | Retry with exponential backoff | After 3 retries, move to DLQ |
| Unique constraint violation | Skip (already exists) | Normal behavior |
| Foreign key violation | Log error, skip event | Source may have been deleted |
| Disk full | Alert immediately | Critical - needs intervention |

---

## Stage 7: Notify

### Purpose
Send batched notifications and alerts.

### Edge Function: `notify-worker`

```typescript
// Responsibilities:
// 1. Aggregate results from completed run
// 2. Send single Slack summary (not per-source)
// 3. Alert on circuit breaker trips
// 4. Alert on DLQ threshold exceeded

interface RunSummary {
  run_id: string;
  started_at: string;
  completed_at: string;
  sources_processed: number;
  events_inserted: number;
  events_updated: number;
  events_skipped: number;
  errors: number;
  circuit_breakers_tripped: string[];  // Source names
  dlq_items_added: number;
}

async function sendRunSummary(summary: RunSummary): Promise<void> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📊 Daily Scrape Complete" }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Sources:* ${summary.sources_processed}` },
        { type: "mrkdwn", text: `*Inserted:* ${summary.events_inserted}` },
        { type: "mrkdwn", text: `*Updated:* ${summary.events_updated}` },
        { type: "mrkdwn", text: `*Errors:* ${summary.errors}` },
      ]
    }
  ];
  
  // Add circuit breaker alerts if any
  if (summary.circuit_breakers_tripped.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *Circuit Breakers Tripped:*\n${summary.circuit_breakers_tripped.join(', ')}`
      }
    });
  }
  
  await sendSlackNotification({ blocks }, summary.errors > 0);
}
```

---

## Resilience Patterns

### 1. Circuit Breaker

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CIRCUIT BREAKER STATE MACHINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────┐      failures >= 5      ┌─────────────┐                  │
│    │   CLOSED    │ ─────────────────────▶  │    OPEN     │                  │
│    │  (healthy)  │                         │  (blocked)  │                  │
│    └──────┬──────┘                         └──────┬──────┘                  │
│           ▲                                       │                          │
│           │                                       │ cooldown elapsed         │
│           │ success                               ▼                          │
│           │                                ┌─────────────┐                  │
│           └─────────────────────────────── │ HALF_OPEN   │                  │
│                                            │  (probing)  │                  │
│                       failure              └─────────────┘                  │
│                          │                        │                          │
│                          └────────────────────────┘                          │
│                                                                              │
│  Cooldown calculation:                                                       │
│  base_cooldown = 30 minutes                                                  │
│  actual_cooldown = base_cooldown * (2 ^ consecutive_opens)                  │
│  max_cooldown = 24 hours                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Dead Letter Queue

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Original context
  job_id UUID,
  source_id UUID REFERENCES scraper_sources(id),
  stage TEXT NOT NULL,  -- fetch, parse, normalize, persist
  
  -- Failure details
  error_type TEXT,  -- timeout, rate_limit, parse_error, db_error
  error_message TEXT,
  error_stack TEXT,
  
  -- Payload for retry
  payload JSONB,  -- Full context to retry from
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Resolution
  status TEXT DEFAULT 'pending',  -- pending, retrying, resolved, discarded
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-retry after 1 hour for first retry, exponential after
CREATE OR REPLACE FUNCTION calculate_next_retry(retry_count INTEGER)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW() + (INTERVAL '1 hour' * POWER(2, retry_count));
END;
$$ LANGUAGE plpgsql;
```

### 3. Graceful Degradation Matrix

| Service | Degradation Strategy | User Impact |
|---------|---------------------|-------------|
| Gemini API | Use rules-based parsing | Slightly lower quality descriptions |
| Serper.dev | Use cached search results | No new sources discovered this week |
| Geocoding API | Use source default coordinates | Events shown at city center |
| ScrapingBee | Mark source for manual review | Some JS-heavy sites may fail |
| Slack | Log locally, retry later | No notifications (monitoring gap) |
| Database | Retry with backoff, then DLQ | Delayed event availability |

### 4. Idempotency

Every operation is idempotent:

```typescript
// Fingerprint ensures same event isn't inserted twice
const fingerprint = sha256(`${title}|${eventDate}|${sourceId}`);

// Upsert pattern
await supabase
  .from('events')
  .upsert(
    { ...event, event_fingerprint: fingerprint },
    { onConflict: 'source_id,event_fingerprint' }
  );
```

---

## Database Schema

### New Tables for v2.0

```sql
-- 1. Pipeline jobs (replaces scrape_jobs)
CREATE TABLE pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  source_id UUID REFERENCES scraper_sources(id),
  current_stage TEXT DEFAULT 'fetch',
  stage_status JSONB,
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 2. Raw pages (HTML storage)
CREATE TABLE raw_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id),
  source_id UUID REFERENCES scraper_sources(id),
  url TEXT NOT NULL,
  html TEXT,
  status_code INTEGER,
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Raw events (before normalization)
CREATE TABLE raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id),
  page_id UUID REFERENCES raw_pages(id),
  source_id UUID REFERENCES scraper_sources(id),
  raw_title TEXT,
  raw_date TEXT,
  raw_location TEXT,
  raw_html TEXT,
  parse_strategy TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Staged events (after normalization)
CREATE TABLE staged_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id),
  raw_event_id UUID REFERENCES raw_events(id),
  source_id UUID REFERENCES scraper_sources(id),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  venue_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  category TEXT,
  event_fingerprint TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Circuit breaker state
CREATE TABLE circuit_breaker_state (
  source_id UUID PRIMARY KEY REFERENCES scraper_sources(id),
  state TEXT DEFAULT 'CLOSED',
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  consecutive_opens INTEGER DEFAULT 0
);

-- 6. Dead letter queue
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  source_id UUID,
  stage TEXT,
  error_type TEXT,
  error_message TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Source health view
CREATE VIEW source_health_status AS
SELECT 
  s.*,
  COALESCE(cb.state, 'CLOSED') as circuit_state,
  COALESCE(cb.failure_count, 0) as failure_count,
  cb.cooldown_until,
  CASE 
    WHEN cb.state = 'OPEN' AND cb.cooldown_until > NOW() THEN false
    WHEN s.auto_disabled THEN false
    WHEN NOT s.enabled THEN false
    ELSE true
  END as is_available
FROM scraper_sources s
LEFT JOIN circuit_breaker_state cb ON s.id = cb.source_id;
```

---

## Shared Utilities (Canonical)

### Directory Structure

```
supabase/functions/_shared/
├── types.ts              # All type definitions
├── pageFetcher.ts        # Unified PageFetcher interface
├── circuitBreaker.ts     # Circuit breaker logic
├── rateLimiting.ts       # Proactive rate limiting
├── dateUtils.ts          # Date parsing (Dutch/English)
├── categoryMapping.ts    # Category classification
├── geocoding.ts          # Location geocoding with cache
├── aiEnrichment.ts       # Gemini API integration
├── slack.ts              # Slack notifications
├── dlq.ts                # Dead letter queue operations
└── observability.ts      # Logging and metrics
```

### Import Convention

```typescript
// ALL edge functions use this pattern
import type { ScraperSource, RawEventCard } from "../_shared/types.ts";
import { createFetcherForSource } from "../_shared/pageFetcher.ts";
import { isCircuitClosed, recordSuccess, recordFailure } from "../_shared/circuitBreaker.ts";
import { canMakeRequest, recordRequest } from "../_shared/rateLimiting.ts";
import { parseToISODate } from "../_shared/dateUtils.ts";
import { classifyTextToCategory } from "../_shared/categoryMapping.ts";
import { sendSlackNotification } from "../_shared/slack.ts";
import { moveToDLQ } from "../_shared/dlq.ts";
```

---

## iOS Integration

### Event Card Display

The pipeline produces events that are immediately consumable by the iOS app:

```typescript
// In iOS app: src/components/EventStackCard.tsx
const EventStackCard = ({ event }: { event: Event }) => {
  // All these fields are guaranteed by the persist stage:
  const { 
    title,           // Always present, normalized
    description,     // May be empty string, never null
    event_date,      // ISO 8601, always valid
    venue_name,      // Always present
    category,        // One of 10 valid categories
    structured_location  // Always has coordinates (at least city-level)
  } = event;
  
  return (
    <Card>
      <Title>{title}</Title>
      <Date>{formatDate(event_date)}</Date>
      <Location>{venue_name}</Location>
      <CategoryBadge category={category} />
    </Card>
  );
};
```

### Feed Algorithm Integration

Events are ranked by the feed algorithm in `src/lib/feedAlgorithm.ts`:

```typescript
// Events from scraper have these properties that affect ranking:
// - category: Matches user preferences
// - location: Distance from user
// - event_date: Time relevance (upcoming events prioritized)
// - source reliability: Events from reliable sources ranked higher
```

---

## Migration Guide

### Phase 1: Database (Week 1)

```bash
# Apply new schema
supabase db push

# Verify tables created
supabase db diff
```

### Phase 2: Shared Code (Week 1)

```bash
# Delete duplicated shared files
rm -rf "tests/scraper edge functions/"

# Verify canonical location
ls supabase/functions/_shared/
```

### Phase 3: Deploy Functions (Week 2)

```bash
# Deploy in order
supabase functions deploy scrape-orchestrator
supabase functions deploy fetch-worker
supabase functions deploy parse-worker
supabase functions deploy normalize-worker
supabase functions deploy persist-worker
supabase functions deploy notify-worker
```

### Phase 4: Cron Jobs (Week 2)

```sql
-- Remove old cron
SELECT cron.unschedule('daily-scrape');

-- Add new orchestrator cron
SELECT cron.schedule('daily-scrape-v2', '0 6 * * *', $$
  SELECT net.http_post(
    'https://PROJECT.supabase.co/functions/v1/scrape-orchestrator',
    '{}',
    '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'
  );
$$);
```

### Phase 5: Monitoring (Week 3)

1. Create Slack webhook for alerts
2. Set up Supabase dashboard for DLQ monitoring
3. Configure alerting thresholds

---

## Operational Runbook

### Daily Checks

```sql
-- 1. Check pipeline health
SELECT 
  current_stage,
  COUNT(*) as jobs,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed,
  COUNT(*) FILTER (WHERE attempts >= max_attempts) as failed
FROM pipeline_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY current_stage;

-- 2. Check circuit breakers
SELECT name, circuit_state, failure_count, cooldown_until
FROM source_health_status
WHERE circuit_state != 'CLOSED';

-- 3. Check DLQ
SELECT stage, error_type, COUNT(*) 
FROM dead_letter_queue
WHERE status = 'pending'
GROUP BY stage, error_type;
```

### Responding to Alerts

| Alert | Action |
|-------|--------|
| Circuit breaker tripped | Check source URL manually, may need selector update |
| DLQ threshold exceeded | Review errors, bulk retry or discard |
| Gemini quota exceeded | Reduce AI enrichment batch size |
| ScrapingBee quota exceeded | Prioritize sources, delay low-priority |

---

*Document Version: 2.0.0*  
*Last Updated: January 2026*  
*Architecture Status: Ready for Implementation*
