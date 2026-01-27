# Comprehensive Scraper Pipeline Architecture Analysis

**Date:** 2026-01-27  
**Status:** Analysis Complete - No Code Changes  
**Severity:** Critical issues identified requiring attention

---

## Executive Summary

The LCL scraper pipeline implements a **resilient, event-driven architecture** designed to prevent full pipeline stoppages through isolation, persistence, and graceful degradation. However, the implementation has several **critical gaps, architectural inconsistencies, and technical debt** that undermine reliability and observability.

### Key Findings

- ✅ **Core architectural patterns are sound** (circuit breakers, DLQ, staged processing)
- ⚠️ **Critical Auth/Rate Limiting Implementation Issues** - Middleware wrappers not properly applied across all functions
- ⚠️ **Inconsistent Error Handling** - Mix of error strategies with gaps in critical paths
- ⚠️ **Database Schema Fragmentation** - 40+ migrations creating schema debt
- ⚠️ **Incomplete Observability** - Missing monitoring for key failure modes
- 🔴 **AI Parsing Single Point of Failure** - No fallback when AI service fails completely

### Quality Scorecard Summary

| Component | Score | Status | Key Issues |
|-----------|-------|--------|-----------|
| Architecture | 7/10 | ✅ Good | Missing explicit orchestration |
| Error Handling | 5/10 | ⚠️ Partial | Inconsistent, some paths uncovered |
| Resilience | 7/10 | ✅ Good | Circuit breaker works but not unified |
| Rate Limiting | 6/10 | ⚠️ Partial | Implemented but not fully wired |
| Data Flow | 6/10 | ⚠️ Partial | Schema fragmentation, defensive coding |
| AI Integration | 4/10 | 🔴 Fragile | No fallback, hard dependency |
| Observability | 5/10 | ⚠️ Minimal | Logging good, metrics missing |
| Performance | 6/10 | ⚠️ Acceptable | AI latency, N+1 queries, no caching |
| Code Quality | 5/10 | ⚠️ Mixed | Duplicate code, syntax issues, large files |
| **OVERALL** | **6/10** | ⚠️ FUNCTIONAL | **Functional but fragile** |

---

## 1. Pipeline Architecture Assessment

### 1.1 Overall Design: 7-Stage Pipeline ✅ GOOD

The architecture follows a clean stages pattern:

```
DISCOVERY → ORCHESTRATION → FETCH → PARSE → NORMALIZE → PERSIST → NOTIFY
   (Weekly)    (Daily)     (Workers) (Workers) (Workers) (Workers) (Batched)
```

**Strengths:**
- Each stage is independent with persistent checkpoints
- Failed items flow to Dead Letter Queue for retry
- Circuit breaker prevents cascading failures from broken sources
- Graceful degradation with fallbacks

**Weaknesses:**
- **No explicit retry logic at coordinator level** - If `scrape-events` or `process-worker` trigger fails, only consecutive_errors counter is incremented (unreliable)
- **Missing stage orchestration** - No explicit DAG/workflow engine; relies on manual function chaining via database state
- **No distributed tracing** - Hard to track an event across pipeline stages

### 1.2 Key Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `scrape-coordinator` | Enqueues jobs for sources, manages circuit breakers | ✅ Working |
| `scrape-events` | Fetches HTML from sources, extracts raw event cards | ⚠️ Has issues |
| `process-worker` | Parses, enriches, and inserts events into database | ⚠️ Has issues |
| `source-discovery-worker` | Discovers new event sources via Serper API | ✅ Working |
| Circuit breaker utilities | Tracks source health, prevents cascade failures | ⚠️ Partial |
| Dead letter queue | Stores failed items for manual review | 🔴 Unused |

---

## 2. Data Flow and Schema Analysis

### 2.1 Data Flow ✅ CORRECT CONCEPTUALLY, ❌ IMPLEMENTATION GAPS

**Tables Involved:**
- `scraper_sources` - Source configs and health status
- `raw_event_staging` - Pre-processing staging area (replaces old schema)
- `events` - Final published events with all enrichment
- `circuit_breaker_state` - Resilience tracking
- `dead_letter_queue` - Failed item storage
- `error_logs` - Centralized error logging
- `rate_limits` - Server-side rate limit tracking
- `scraper_insights` - Extraction method analytics

**Critical Gap:** Defensive schema compatibility code in `process-worker` (lines 178-224) indicates migration was incomplete:

```typescript
// This mismatch exists - code has to handle multiple schema versions
if (row.raw_payload && typeof row.raw_payload === "object") { ... }  // ❌ May fail
else if (row.raw_html) { ... }  // ✅ Fallback is correct
```

### 2.2 Schema Fragmentation: 40+ Migration Files 🔴 CRITICAL DEBT

```bash
20260112210718_add_scraper_sources.sql
20260114130000_source_discovery_and_self_healing.sql
20260115000000_fix_auto_disable_trap.sql
20260116000000_resilient_pipeline_architecture.sql
20260117165300_add_rate_limit_state_columns.sql
20260120150000_add_fetcher_type.sql
20260121000001_data_first_elt.sql
20260122000000_add_claim_staging_rows.sql
... and 30+ more
```

**Problems:**
- Multiple column additions across files (e.g., `fetcher_type` added in 2 different migrations)
- Schema evolution scattered across time; no consolidated "current state" documentation
- **Risk:** Unknown if all migrations have been applied correctly or if some conflict
- **Effort:** Estimated 5+ hours to consolidate schema and verify consistency

**Recommendation:** Create a `SCHEMA_CURRENT.sql` file showing the actual production schema state.

### 2.3 Missing or Unclear Schemas

Referenced in documentation but unclear if implemented:

- **`pipeline_jobs` table** - Referenced in SCRAPER_ARCHITECTURE.md but not found in code
- **`raw_pages` table** - Mentioned in docs but not visible in code
- **`raw_events` table** - Mentioned but code uses `raw_event_staging`
- **`staged_events` table** - Mentioned but code writes directly to `events`

**Conclusion:** Schema in code differs from documented design. **Documentation is aspirational, not current.**

---

## 3. Error Handling and Resilience Patterns

### 3.1 Circuit Breaker Implementation ✅ WELL-DESIGNED, ⚠️ INCONSISTENT USAGE

**Location:** `supabase/functions/_shared/circuitBreaker.ts`

**Strengths:**
- Three states: CLOSED → OPEN → HALF_OPEN
- Configurable thresholds (default 5 failures before open)
- Exponential backoff on cooldown (30 min to 24 hours)
- Database-backed state (survives restarts)

**Critical Weaknesses:**

1. **Not called consistently** 
   - `scrape-events` checks circuit (lines 58-73)
   - `process-worker` does NOT check circuit breaker
   - Should skip processing if source's circuit is open

2. **Failure recording is duplicated and inconsistent:**
   ```typescript
   // scrape-coordinator/index.ts: Increments consecutive_errors
   await supabase.rpc("increment_source_errors", { p_source_ids: failedSourceIds })
   
   // BUT scrape-events/index.ts: Calls recordFailure() -> updates circuit_breaker_state
   await recordFailure(supabaseUrl, supabaseServiceRoleKey, sourceId, e.message, 5)
   ```
   **These are TWO different failure tracking systems** - should be unified

3. **No automatic alert when circuit opens** 
   - Need manual intervention or cron job to detect
   - Should send Slack alert when circuit opens

### 3.2 Dead Letter Queue ✅ IMPLEMENTED, 🔴 NEVER USED

**Location:** `supabase/functions/_shared/dlq.ts`

**Status:** Fully implemented with exponential backoff and retry scheduling, but:
- **`addToDLQ()` function is never imported or called**
- Should be used when raw event fails to process after max retries
- Current behavior: Failed rows marked as `pending_with_backoff` but not explicitly moved to DLQ

**Recommendation:** Activate DLQ usage in `process-worker` when rows exhaust retries.

### 3.3 Retry Logic ⚠️ PARTIAL IMPLEMENTATION

**Process Worker:**
```typescript
const newStatus = newRetries >= maxRetries ? "pending_with_backoff" : "pending";
const backoffMinutes = newRetries >= maxRetries ? Math.pow(2, newRetries - maxRetries) * 5 : 0;
```

**Issues:**
- Hardcoded max retries = 3
- Retries happen at claim time (`claim_staging_rows` RPC checks `updated_at <= NOW()`)
- **No actual retry logic in process-worker** - relies entirely on RPC function
- If RPC is slow, claim window may be missed

**Missing:** No retry for fetcher (scrape-events) failures - only circuit breaker blocks future attempts.

---

## 4. Rate Limiting and Authentication

### 4.1 Server-Side Rate Limiting ✅ CORRECTLY IMPLEMENTED, ⚠️ INCOMPLETE INTEGRATION

**Location:** `supabase/functions/_shared/serverRateLimiting.ts`

**Design:**
- Database-backed sliding window (100% accurate, not bypassable by clients)
- Default limits:
  - `scrape-coordinator`: 10 req/min
  - `process-worker`: 60 req/min
  - `scrape-events`: 30 req/min

**Issue:** Implementation is incomplete in actual functions:

```typescript
// scrape-coordinator/index.ts line 34:
serve(withRateLimiting(withAuth(...), 'scrape-coordinator'))

// This syntax has issues - middleware wrappers may not be correctly applied
```

### 4.2 Authentication ✅ IMPLEMENTED, ⚠️ INTEGRATION ISSUES

**Location:** `supabase/functions/_shared/auth.ts`

**Features:**
- API key validation (Bearer token or x-api-key header)
- Request signing validation using HMAC-SHA256
- Support for multiple key types: service, admin, worker
- Constant-time comparison to prevent timing attacks

**Issues:**
- Syntax errors in wrapper application (documented in SCRAPER_FIXES_SUMMARY.md)
- May not be fully wired to all functions

### 4.3 Source-Level Rate Limiting ✅ EXISTS, ⚠️ ADAPTIVE LOGIC UNCLEAR

**Functions:** 
- `increaseRateLimit()` - Updates source rate limits after 403/429
- `getEffectiveRateLimit()` - Applies dynamic adjustments

**Issue:** Usage not visible in scraper code - appears to be intended but not integrated.

---

## 5. AI Parsing Integration

### 5.1 Architecture ✅ REASONABLE, 🔴 FRAGILE

**Pipeline:**
```
RawEventCard → Trust check (hydration/json_ld/feed?)
              ↓
              Yes → Use trusted data, skip AI
              ↓
              No → Try JSON-LD on card
                   ↓
                   No → Try JSON-LD on detail HTML
                        ↓
                        No → Call AI (OpenAI/Gemini)
```

**Code Location:** `process-worker/index.ts` lines 346-475

**Strengths:**
- Waterfall approach reduces AI call costs
- Trusted methods skip expensive AI
- Detail HTML is fetched proactively

**Critical Weaknesses:**

1. **No fallback if AI fails:**
   ```typescript
   // If AI fails, continues with incomplete data - no error thrown
   if (!normalized.image_url || normalized.description?.length < 100) {
     const aiParsed = await runAIParsing(htmlToParse);
     if (aiParsed) { ... }
     // If aiParsed is null, continues silently ❌
   }
   ```

2. **Hard error if openaiApiKey missing:**
   ```typescript
   // Line 816: Throws immediately, crashes entire worker
   const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
   if (!openaiApiKey) throw new Error("Missing OPENAI_API_KEY");
   ```
   Should fail gracefully, not crash entire worker.

3. **No circuit breaker for AI service:**
   - If OpenAI is down, all process-worker calls fail
   - Should track AI failures and skip AI after threshold
   - No tracking of AI rate limit state in database

4. **Blocking AI calls slow down entire pipeline:**
   - No timeout after 30s
   - Could hang indefinitely on slow AI responses

**Recommendation:**
- Make `openaiApiKey` optional (use fallback if missing)
- Add circuit breaker for AI service failures
- Track AI API errors in database
- Return event with minimal data rather than fail completely
- Add timeout for AI calls (5 seconds)

---

## 6. Observability and Monitoring Capabilities

### 6.1 Logging ✅ COMPREHENSIVE

**Features:**
- `errorLogging.ts` - Centralized error logs with Slack forwarding
- Multiple log levels (debug, info, warn, error, fatal)
- Context preservation (request_id, user_agent, stack_trace)
- Automatic Slack alerts for errors/fatal

**Gap:** Not all functions use error logging consistently:
- `process-worker` has try-catch but doesn't call `logError()` in all error paths
- `scrape-events` error handling is incomplete

### 6.2 Observability Utilities ⚠️ PARTIALLY USED

**Location:** `scraperObservability.ts`

Functions available but **appears unused:**
- `logScraperFailure()` - Never imported
- `getHistoricalEventCount()` - Never called
- `increaseRateLimit()` - Not visible in code
- `getEffectiveRateLimit()` - Not visible in code

**Issue:** Functions exist but integration is missing.

### 6.3 Metrics and Health Checks ❌ MISSING

**No built-in way to:**
- Query queue depth (how many rows pending in raw_event_staging?)
- Track end-to-end latency (time from fetch to event creation)
- Monitor AI API usage and costs
- Track deduplication stats
- Monitor image optimization success rates
- Alert on DLQ size exceeding threshold

**Recommendation:** Create a health check function that returns:
```json
{
  "pending_staging_rows": 150,
  "avg_processing_time_ms": 2340,
  "ai_calls_last_hour": 450,
  "dlq_pending_count": 12,
  "circuit_breaker_open_count": 3,
  "sources_with_errors": ["source-id-1", "source-id-2"]
}
```

---

## 7. Performance Bottlenecks

### 7.1 Identified Bottlenecks

1. **AI Parsing Latency** (Estimated: 1-3 seconds per event)
   - Sequential waterfall (JSON-LD → AI) causes blocking
   - Should parallel-fetch detail HTML while trying JSON-LD
   - AI fallback is blocking (no timeout after 30s)

2. **Database Round-Trips**
   - `claimPendingRows()` - 1 RPC call per batch
   - `completeRow()` - N+1 updates (1 per row)
   - `checkDuplicate()` - 2 queries per event (hash + fingerprint)
   - Should batch updates: `UPDATE raw_event_staging SET status='completed' WHERE id IN (...)`

3. **Image Optimization** (Estimated: 500ms-2s per image)
   - Blocked by image fetch → upload to Supabase Storage
   - Should be async background job, not in critical path
   - Currently non-blocking but still serialized

4. **Geocoding Latency** (Estimated: 500ms-1s per venue)
   - Called per event if venue has no coordinates
   - Should cache results by venue name
   - Could be parallelized with AI parsing

5. **Rate Limit State Tracking**
   - `checkRateLimit()` inserts row per request (could cause DB load)
   - Sliding window with cleanup could be expensive
   - Consider Redis for rate limiting instead of Postgres

### 7.2 Estimated Pipeline Throughput

```
Coordinator triggers 50 sources
  ↓
scrape-events processes each (~2s per source)
  ↓
100 events staged after 100s
  ↓
process-worker in batches of 10 (~10s per batch)
  ↓
Total: ~110-120 seconds for full pipeline
```

**Issue:** With 50 sources × 10 events = 500 events, if each takes 2-3s average (fetch + parse + AI + enrichment + insert), pipeline could take 16-25 minutes per coordinator run.

---

## 8. Code Quality and Maintainability Concerns

### 8.1 Critical Issues

| Issue | Severity | Impact | Location |
|-------|----------|--------|----------|
| **Duplicate imports** | 🔴 HIGH | Syntax errors | scrape-events/index.ts line 8-11 |
| **Middleware wrapper inconsistency** | 🔴 HIGH | Rate limiting not applied | Multiple functions |
| **Mixed failure tracking** | 🔴 HIGH | Unreliable circuit breaker | coordinator vs scrape-events |
| **Defensive schema mapping** | 🟡 MEDIUM | Code smell, hidden bug | process-worker line 178-224 |
| **Unused utility functions** | 🟡 MEDIUM | Dead code | dlq.ts, observability.ts |
| **Hard-coded thresholds** | 🟡 MEDIUM | Config management debt | Multiple files |

### 8.2 Code Issues by Function

**scrape-coordinator/index.ts:**
- ✅ Good structure
- ⚠️ Fire-and-forget `fetch()` calls - no error handling until later
- ⚠️ 500ms delay assumption may be too short

**scrape-events/index.ts:**
- 🔴 Duplicate imports
- ⚠️ `withAuth` and `withRateLimiting` syntax incorrect
- ⚠️ Pagination recursion error handling silent

**process-worker/index.ts:**
- ✅ Comprehensive parsing logic
- ⚠️ ~880 lines - consider splitting
- ⚠️ No error logging at top level
- ⚠️ Assumes `detail_html` fetching always succeeds
- 🔴 Optional `openaiApiKey` not properly handled

### 8.3 Type Safety

✅ Good: Canonical types in `_shared/types.ts` (RawEventCard, NormalizedEvent, EnrichedEvent)

⚠️ Issues:
- Type casting: `row.detail_html` may not exist on old schema
- Any-type abuse in strategy patterns
- Inconsistent use of optional vs required fields

---

## 9. Architecture Gaps and Missing Pieces

### 9.1 Missing Components

| Component | Impact | Why Missing |
|-----------|--------|-------------|
| **Service mesh/tracing** | 🔴 Can't trace events across stages | Would add complexity |
| **Workflow orchestration** | 🔴 Manual function chaining error-prone | Supabase doesn't have native support |
| **Cache layer** | 🟡 Repeated queries (dedup, geocoding) | Not implemented |
| **Async job scheduler** | 🟡 Image optimization should be bg job | Edge functions timeout constraints |
| **Metrics/timeseries DB** | 🟡 No performance tracking | Supabase doesn't have native time-series |
| **Secrets rotation** | 🟡 API keys stored as env vars | No automated rotation |
| **Batch processing framework** | 🟡 Manual batch logic in functions | Should use Supabase Jobs or cron |

### 9.2 Architectural Anti-Patterns

1. **Tight coupling to Supabase RPC functions**
   - If RPC is slow, entire pipeline slows down
   - No fallback to direct SQL

2. **Edge function chains via HTTP**
   - Latency: ~200ms per trigger
   - State between functions implicit (database only)
   - Better: Use event-driven queue (e.g., pgboss in Supabase)

3. **No explicit state machine**
   - Rows move between statuses but no formal FSM
   - Status transitions:
     - pending → completed ✅
     - pending → pending_with_backoff ✅
     - pending → ? (unknown final failure state)
   - Should document all valid transitions

---

## 10. Recommendations (Prioritized)

### CRITICAL (1-2 weeks) 🔴

1. **Fix Duplicate Imports**
   - Remove duplicate imports in scrape-events/index.ts
   - Fix syntax errors in middleware wrappers
   - **Impact:** Prevents syntax errors, enables proper rate limiting

2. **Unify Failure Tracking**
   - Choose ONE failure tracking system (circuit_breaker_state OR consecutive_errors)
   - Recommendation: Use circuit_breaker_state exclusively
   - Update coordinator to call `recordFailure()` instead of incrementing counter
   - **Impact:** Reliable circuit breaker logic

3. **Make openaiApiKey Gracefully Optional**
   - Check if key exists; if not, skip AI parsing
   - Mark events with `ai_parsing_skipped: true`
   - Continue with rule-based extraction
   - **Impact:** Pipeline survives without AI service

4. **Add Circuit Breaker Check in process-worker**
   - Before processing row from source, check circuit state
   - Skip if OPEN, log warning
   - **Impact:** Prevents wasted processing on broken sources

### HIGH (2-4 weeks) 🟡

5. **Consolidate Database Schema**
   - Create `SCHEMA_CURRENT.sql` with actual production schema
   - Remove defensive type-checking code from process-worker
   - Document all table relationships
   - **Impact:** Reduced technical debt, easier onboarding

6. **Activate Dead Letter Queue**
   - Move failed rows to DLQ after 3 retries
   - Add DLQ monitoring dashboard
   - Implement DLQ reprocessing batch job
   - **Impact:** Better failure visibility and recovery

7. **Add Comprehensive Error Logging**
   - Wrap all try-catch blocks with `logError()` calls
   - Include context (row ID, source ID, stage name)
   - Ensure all error paths are logged
   - **Impact:** Full observability of failures

8. **Implement Health Check Endpoint**
   - Return pipeline metrics (pending rows, DLQ size, circuit breakers, etc.)
   - Expose at `/functions/v1/health`
   - Monitor in Grafana/Prometheus
   - **Impact:** Real-time monitoring and alerting

### MEDIUM (1 month) 🟠

9. **Optimize AI Parsing**
   - Parallel JSON-LD extraction while fetching detail HTML
   - Add timeout of 5s for AI calls (fail fast)
   - Track AI failure rate and auto-disable if > 50%
   - Implement circuit breaker for AI service
   - **Impact:** Reduced latency, better resilience

10. **Batch Database Operations**
    - Use bulk update instead of N individual updates
    - Implement batch insert for events
    - Reduce RPC calls
    - **Impact:** 30-50% latency improvement

11. **Add Caching Layer**
    - Cache geocoding results by venue name (1 day TTL)
    - Cache JSON-LD extraction results by URL
    - Use Redis or Supabase cache
    - **Impact:** Reduced API calls, lower latency

12. **Document All State Transitions**
    - Create state diagram for raw_event_staging status
    - Document all valid transitions
    - Add validation to prevent invalid states
    - **Impact:** Easier debugging, fewer state machine bugs

### NICE-TO-HAVE (2+ months) 💡

13. **Implement Event-Driven Workflow**
    - Replace HTTP-based function chaining with pgboss or Supabase Queue
    - Add explicit workflow orchestration
    - **Impact:** Better reliability, reduced latency

14. **Add Distributed Tracing**
    - Use request_id to track events across stages
    - Log request_id at each stage
    - Integrate with OpenTelemetry
    - **Impact:** Full pipeline visibility

15. **Implement Cost Tracking**
    - Log AI API costs per source
    - Calculate ROI of expensive sources
    - Alert on cost spikes
    - **Impact:** Data-driven source prioritization

---

## 11. Known Issues from Documentation

### From SCRAPER_FIXES_SUMMARY.md:

1. ✅ **Strategic Coordinates** - Fallback to POINT(0 0) if missing (implemented)
2. ✅ **Image Prioritization** - Correct order: scraped > AI > null (implemented)
3. ✅ **Quality Score Regex** - Fixed time validation (implemented)
4. ⚠️ **Coordinator Error Handling** - Syntax errors encountered during implementation
5. ⚠️ **Auth Wrappers** - Authentication added but integration has syntax issues

### From ACTION_REQUIRED.md:

- `scraper_insights` table migration status unclear
- Waterfall intelligence tests blocked on migration

---

## 12. Conclusion

The scraper pipeline demonstrates **solid architectural thinking** (stages, isolation, graceful degradation) but **incomplete implementation** with scattered technical debt and inconsistencies. The system will work for moderate load but lacks resilience for production issues (AI outage, source downtime, database slowness).

### Critical Path Forward

**Week 1-2:** Fix syntax errors, unify failure tracking, make AI optional
**Week 3-4:** Consolidate schema, activate DLQ, comprehensive error logging
**Month 2:** Optimize AI parsing, batch operations, caching
**Month 3+:** Event-driven architecture, distributed tracing, cost tracking

### Final Verdict

**Overall Score: 6/10 - FUNCTIONAL BUT FRAGILE**

The pipeline works for current load but needs immediate attention to:
1. Fix critical bugs (duplicate imports, middleware wrappers)
2. Improve resilience (unified failure tracking, AI fallback)
3. Enhance observability (health checks, metrics)
4. Reduce technical debt (schema consolidation, dead code removal)

Focus on critical issues first (weeks 1-2) to stabilize the pipeline, then systematically address medium-priority improvements.
