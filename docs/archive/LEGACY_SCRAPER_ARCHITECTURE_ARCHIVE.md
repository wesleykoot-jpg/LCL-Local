# Legacy Scraper Architecture Archive (Pre-Waterfall Intelligence v2)

> **Document Type**: Technical Archive  
> **Created**: January 2026  
> **Purpose**: Preserve documentation of existing scraper infrastructure before Waterfall Intelligence v2 implementation  
> **Status**: Read-Only Reference

---

## Table of Contents

1. [Overview](#1-overview)
2. [4-Tier Waterfall Extraction System](#2-4-tier-waterfall-extraction-system)
3. [Two-Pass Execution Model](#3-two-pass-execution-model)
4. [Source Tier Classification](#4-source-tier-classification)
5. [Fetcher Type Self-Healing](#5-fetcher-type-self-healing)
6. [Scraper Insights Tracking](#6-scraper-insights-tracking)
7. [Database Schema Reference](#7-database-schema-reference)
8. [Key File Locations](#8-key-file-locations)

---

## 1. Overview

The LCL scraper pipeline implements a sophisticated, resilient event extraction system. This document archives the existing implementation as of January 2026, before the Waterfall Intelligence v2 enhancements.

### Core Design Principles

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        RESILIENT PIPELINE PRINCIPLES                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  1. ISOLATION     Each stage is independent                                         │
│  2. PERSISTENCE   Every intermediate result is saved                                │
│  3. CIRCUIT       Failing sources are quarantined                                   │
│     BREAKERS                                                                        │
│  4. GRACEFUL      AI unavailable? Use rule-based fallback                          │
│     DEGRADATION                                                                     │
│  5. OBSERVABILITY Every failure is logged with context                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 4-Tier Waterfall Extraction System

### Implementation Location
- **Primary File**: `supabase/functions/_shared/dataExtractors.ts` (1,304 lines)
- **CMS Fingerprinter**: `supabase/functions/_shared/cmsFingerprinter.ts` (387 lines)

### Architecture

The extraction system implements a priority-based waterfall that tries strategies in order until events are found:

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                         EXTRACTION WATERFALL                                        │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  PRIORITY 1: HYDRATION ──────► "Gold Standard" (100% accuracy)                     │
│  │                                                                                  │
│  │  Targets: Next.js, Nuxt, React, Wix frameworks                                  │
│  │  Method: Extract from window.__NEXT_DATA__, __INITIAL_STATE__, etc.             │
│  │  Benefit: Bypasses visual changes, contains IDs/coordinates                     │
│  │                                                                                  │
│  ▼ (if 0 events)                                                                   │
│                                                                                     │
│  PRIORITY 2: JSON-LD ────────► High Fidelity                                       │
│  │                                                                                  │
│  │  Targets: WordPress, Squarespace, Schema.org sites                              │
│  │  Method: Parse <script type="application/ld+json">                              │
│  │  Includes: Soft repair for malformed JSON, @graph support                       │
│  │                                                                                  │
│  ▼ (if 0 events)                                                                   │
│                                                                                     │
│  PRIORITY 3: FEEDS ──────────► Medium Fidelity                                     │
│  │                                                                                  │
│  │  Targets: Municipal calendars, libraries, community sites                       │
│  │  Method: Discover and parse RSS, Atom, ICS feeds                                │
│  │  Includes: Auto-discovery of /feed, /calendar.ics, etc.                         │
│  │                                                                                  │
│  ▼ (if 0 events)                                                                   │
│                                                                                     │
│  PRIORITY 4: DOM ────────────► Fallback (Lowest Fidelity)                          │
│                                                                                     │
│     Targets: Custom HTML sites without structured data                             │
│     Method: Cheerio CSS selectors, heuristic extraction                            │
│     Selectors: 14+ default patterns for common event layouts                       │
│                                                                                     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### TypeScript Interface

```typescript
// From supabase/functions/_shared/dataExtractors.ts

export type ExtractionStrategy =
  | "hydration"
  | "json_ld"
  | "microdata"
  | "feed"
  | "iframe"
  | "dom";

export interface WaterfallResult {
  /** The winning strategy that produced events */
  winningStrategy: ExtractionStrategy | null;
  /** Total events found */
  totalEvents: number;
  /** All extracted events */
  events: RawEventCard[];
  /** Trace of all strategies tried */
  strategyTrace: Record<ExtractionStrategy, Omit<ExtractionResult, "events">>;
  /** Total time for all extractions */
  totalTimeMs: number;
}
```

### Hydration Patterns Detected

```typescript
const HYDRATION_PATTERNS = [
  { name: "__NEXT_DATA__", regex: /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i },
  { name: "__NUXT__", regex: /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: "__INITIAL_STATE__", regex: /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: "__PRELOADED_STATE__", regex: /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: "__APP_DATA__", regex: /window\.__APP_DATA__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
];
```

### Supported JSON-LD Event Types

```typescript
const VALID_EVENT_TYPES = [
  "Event", "SportsEvent", "MusicEvent", "Festival", "TheaterEvent",
  "DanceEvent", "ComedyEvent", "ExhibitionEvent", "SocialEvent",
  "BusinessEvent", "EducationEvent", "FoodEvent", "ScreeningEvent",
];
```

### DOM Fallback Selectors

```typescript
const DEFAULT_DOM_SELECTORS = [
  ".event-item", ".event-card", ".agenda-item", ".calendar-event",
  "[itemtype*='Event']", "li.event", ".post-item", ".datum-item",
  ".activity-card", ".card--event", ".event-list-item", ".program-item",
  ".agenda-entry",
];
```

### Main Entry Point

```typescript
/**
 * Runs the extraction waterfall: tries each strategy in priority order
 * and stops when events are found.
 */
export async function runExtractionWaterfall(
  html: string,
  ctx: FeedExtractionContext,
): Promise<WaterfallResult>
```

---

## 3. Two-Pass Execution Model

### Purpose
Decouple lightweight discovery from expensive enrichment to prevent Edge Function timeouts.

### Pass 1: Discovery (`scrape-events`)

**Function**: `supabase/functions/scrape-events/index.ts`

**Responsibilities**:
1. Fetch source URL (with ScrapingBee failover)
2. Check content hash for changes (delta detection)
3. Extract basic event data from listing pages
4. Stage raw events to `raw_event_staging` table
5. Handle pagination (recursive, MAX_DEPTH=3)

**Output**: Events with minimal fields:
- `title`, `date`, `location`, `detail_url`, `image_url`
- Status: `pending` (awaiting enrichment)

### Pass 2: Enrichment (`process-worker`)

**Function**: `supabase/functions/process-worker/index.ts`

**Responsibilities**:
1. Claim pending rows from `raw_event_staging` (batch of 10)
2. Fetch detail pages for full content
3. Run waterfall extraction on detail pages
4. AI parsing fallback for complex content
5. Geocode addresses
6. Calculate quality scores
7. Generate content hash and event fingerprint
8. Upsert to `events` table with deduplication

**Output**: Fully enriched events with:
- Full description, precise dates/times
- Geocoded coordinates
- Category classification
- Quality score (0-1)

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              TWO-PASS EXECUTION MODEL                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  PASS 1: DISCOVERY                        PASS 2: ENRICHMENT                        │
│  ─────────────────                        ──────────────────                        │
│                                                                                      │
│  scraper_sources                          raw_event_staging                         │
│       │                                        │                                    │
│       ▼                                        ▼                                    │
│  ┌──────────────┐                        ┌──────────────┐                          │
│  │ scrape-events│                        │process-worker│                          │
│  │              │                        │              │                          │
│  │ • Fetch HTML │                        │ • Claim rows │                          │
│  │ • Delta check│                        │ • Fetch detail│                         │
│  │ • Quick parse│                        │ • AI enrich  │                          │
│  │ • Pagination │                        │ • Geocode    │                          │
│  └──────┬───────┘                        │ • Score      │                          │
│         │                                │ • Dedup      │                          │
│         ▼                                └──────┬───────┘                          │
│  raw_event_staging                              │                                   │
│  status: 'pending'                              ▼                                   │
│                                            events table                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Source Tier Classification

### Implementation Location
- **Migration**: `supabase/migrations/20260121000000_data_first_pipeline.sql`
- **Column**: `scraper_sources.tier`

### Tier Definitions

```sql
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'general' 
CHECK (tier IN ('aggregator', 'venue', 'general'));
```

| Tier | Name | Description | Examples |
|------|------|-------------|----------|
| `aggregator` | Tier 1 | Major aggregator sites with structured data | Ticketmaster, Eventbrite, municipal uitagendas |
| `venue` | Tier 2 | Individual venue websites | Paradiso, Melkweg, local theaters |
| `general` | Tier 3 | Discovery/general sites | Community blogs, café listings |

### Preferred Method Column

```sql
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS preferred_method text DEFAULT 'auto'
CHECK (preferred_method IN ('hydration', 'json_ld', 'feed', 'dom', 'auto'));
```

When `preferred_method` is set to a specific value (not `auto`), the waterfall starts with that strategy and skips lower-priority methods on success.

### Deep Scrape Toggle

```sql
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS deep_scrape_enabled boolean DEFAULT false;
```

When enabled, the process-worker fetches event detail pages to extract richer data (times, descriptions, images).

---

## 5. Fetcher Type Self-Healing

### Implementation Location
- **Migration**: `supabase/migrations/20260114130000_source_discovery_and_self_healing.sql`
- **Function**: `check_and_heal_fetcher()`

### Fetcher Types Enum

```sql
CREATE TYPE public.fetcher_type_enum AS ENUM (
  'static',      -- Simple HTTP fetch
  'puppeteer',   -- Headless Chrome
  'playwright',  -- Playwright browser
  'scrapingbee'  -- ScrapingBee API
);
```

### Self-Healing Logic

The system automatically upgrades the fetcher type when a source returns 0 events 3+ consecutive times with HTTP 200 status:

```sql
CREATE OR REPLACE FUNCTION check_and_heal_fetcher(
  p_source_id uuid,
  p_events_found integer,
  p_http_status integer
)
RETURNS jsonb
```

**Upgrade Path**:
```
static → puppeteer → scrapingbee
```

### Tracking Columns

```sql
-- Tracks consecutive zero-event runs
ALTER TABLE scraper_sources
ADD COLUMN IF NOT EXISTS consecutive_zero_events integer DEFAULT 0;

-- Last time events were actually found
ALTER TABLE scraper_sources
ADD COLUMN IF NOT EXISTS last_non_zero_scrape timestamptz DEFAULT NULL;
```

### Behavior

1. **Events found**: Reset `consecutive_zero_events` to 0
2. **Zero events with HTTP 200**: Increment counter
3. **Counter reaches 3**: Upgrade fetcher type, reset counter
4. **Non-200 status**: Don't count (error handling, not zero-event issue)

---

## 6. Scraper Insights Tracking

### Implementation Location
- **Migration**: `supabase/migrations/20260121000000_data_first_pipeline.sql`
- **Table**: `scraper_insights`

### Table Schema

```sql
CREATE TABLE IF NOT EXISTS public.scraper_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id UUID REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
    run_id UUID DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- The Outcome
    status TEXT CHECK (status IN ('success', 'partial', 'failure')),
    total_events_found INT DEFAULT 0,
    winning_strategy TEXT,  -- e.g., 'hydration', 'json_ld', 'feed', 'dom'
    
    -- Strategy Trace (JSONB)
    strategy_trace JSONB DEFAULT '{}'::jsonb,
    -- Example: {"hydration": {"tried": true, "found": 0, "error": null}, 
    --           "json_ld": {"tried": true, "found": 15, "error": null}}
    
    -- CMS Detection
    detected_cms TEXT,
    detected_framework TEXT,
    
    -- Performance Metrics
    execution_time_ms INT,
    fetch_time_ms INT,
    parse_time_ms INT,
    
    -- HTML Analysis
    html_size_bytes INT,
    has_hydration_data BOOLEAN DEFAULT FALSE,
    has_json_ld BOOLEAN DEFAULT FALSE,
    has_rss_feed BOOLEAN DEFAULT FALSE,
    has_ics_feed BOOLEAN DEFAULT FALSE,
    
    -- Error details
    error_message TEXT,
    error_stack TEXT
);
```

### Logging Function

```sql
CREATE OR REPLACE FUNCTION public.log_scraper_insight(
    p_source_id UUID,
    p_status TEXT,
    p_total_events_found INT,
    p_winning_strategy TEXT,
    p_strategy_trace JSONB,
    ...
)
RETURNS UUID
```

### Auto-Optimization Logic

After 3 consecutive successful runs with the same strategy, the function automatically updates the source's `preferred_method`:

```sql
-- Auto-optimize after 3 consistent successes with same strategy
IF v_consistent_count >= 3 THEN
    UPDATE public.scraper_sources
    SET 
        preferred_method = p_winning_strategy,
        detected_cms = COALESCE(p_detected_cms, detected_cms),
        updated_at = NOW()
    WHERE id = p_source_id
      AND preferred_method = 'auto'; -- Only update if still on auto
END IF;
```

### Health View

```sql
CREATE OR REPLACE VIEW public.source_health_with_insights AS
SELECT 
    s.*,
    COALESCE(latest.status, 'unknown') as last_insight_status,
    latest.winning_strategy as last_winning_strategy,
    latest.total_events_found as last_events_found,
    latest.execution_time_ms as last_execution_time_ms,
    latest.detected_framework,
    stats.success_count,
    stats.failure_count,
    stats.avg_events_per_run,
    stats.most_common_strategy
FROM public.scraper_sources s
LEFT JOIN LATERAL (...) latest ON true
LEFT JOIN LATERAL (...) stats ON true;
```

---

## 7. Database Schema Reference

### scraper_sources Table (Key Columns)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Human-readable source name |
| `url` | TEXT | Source URL to scrape |
| `enabled` | BOOLEAN | Whether source is active |
| `tier` | TEXT | 'aggregator', 'venue', 'general' |
| `preferred_method` | TEXT | 'hydration', 'json_ld', 'feed', 'dom', 'auto' |
| `deep_scrape_enabled` | BOOLEAN | Fetch detail pages |
| `fetcher_type` | fetcher_type_enum | 'static', 'puppeteer', 'playwright', 'scrapingbee' |
| `consecutive_failures` | INT | For circuit breaker |
| `consecutive_zero_events` | INT | For self-healing fetcher |
| `detected_cms` | TEXT | Auto-detected CMS platform |
| `last_scraped_at` | TIMESTAMPTZ | Last successful scrape |
| `last_payload_hash` | TEXT | SHA256 for delta detection |

### CMS Fingerprinting

```typescript
export type CMSType = 
  | 'wordpress' | 'wix' | 'squarespace' | 'next.js' 
  | 'nuxt' | 'react' | 'drupal' | 'joomla'
  | 'shopify' | 'webflow' | 'unknown';

export interface CMSFingerprint {
  cms: CMSType;
  version: string | null;
  confidence: number;  // 0-100
  recommendedStrategies: ExtractionPreset[];
  requiresJsRender: boolean;
  detectedDataSources: {
    hasHydrationData: boolean;
    hasJsonLd: boolean;
    hasRssFeed: boolean;
    hasIcsFeed: boolean;
    hasMicrodata: boolean;
  };
  signals: string[];
}
```

---

## 8. Key File Locations

### Core Extraction Engine

| File | Purpose | Lines |
|------|---------|-------|
| `supabase/functions/_shared/dataExtractors.ts` | 4-tier waterfall, all extraction strategies | 1,304 |
| `supabase/functions/_shared/cmsFingerprinter.ts` | CMS detection, strategy recommendations | 387 |
| `supabase/functions/_shared/jsonLdParser.ts` | JSON-LD parsing utilities | ~200 |
| `supabase/functions/_shared/strategies.ts` | Per-source strategy classes | ~700 |

### Pipeline Functions

| File | Purpose |
|------|---------|
| `supabase/functions/scrape-events/index.ts` | Pass 1: Discovery |
| `supabase/functions/process-worker/index.ts` | Pass 2: Enrichment |
| `supabase/functions/scrape-coordinator/index.ts` | Orchestration |

### Key Migrations

| Migration | Purpose |
|-----------|---------|
| `20260114130000_source_discovery_and_self_healing.sql` | Fetcher self-healing, auto-discovery columns |
| `20260121000000_data_first_pipeline.sql` | Tier config, preferred_method, scraper_insights |
| `20260114094900_add_fetcher_type.sql` | fetcher_type_enum |

### Local Runners (Development)

| File | Purpose |
|------|---------|
| `scripts/run_process_worker_safe.ts` | Local process-worker execution |
| `supabase/functions/process-worker/local_runner.ts` | Local Deno execution |

---

## Appendix: Sample Strategy Trace

Example `strategy_trace` from `scraper_insights`:

```json
{
  "hydration": {
    "tried": true,
    "found": 0,
    "error": null,
    "timeMs": 12
  },
  "json_ld": {
    "tried": true,
    "found": 15,
    "error": null,
    "timeMs": 45
  },
  "feed": {
    "tried": false,
    "found": 0,
    "error": null,
    "timeMs": 0
  },
  "dom": {
    "tried": false,
    "found": 0,
    "error": null,
    "timeMs": 0
  }
}
```

This shows JSON-LD was the winning strategy (found 15 events), so feed and DOM were never attempted.

---

*Archive created: January 2026*  
*This document is read-only and preserved for historical reference.*
