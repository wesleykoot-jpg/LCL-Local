# Shared Modules Import Guide

## Overview

All Edge Functions MUST import shared utilities from `supabase/functions/_shared/` to prevent code duplication and interface drift. This document outlines the canonical import patterns for the scraper pipeline.

## Canonical Import Patterns

### ✅ Correct Imports (from _shared)

```typescript
// Date utilities
import { parseToISODate } from "../_shared/dateUtils.ts";

// Fetching strategies
import { 
  createSpoofedFetch, 
  resolveStrategy,
  createFetcherForSource,
  type PageFetcher,
  StaticPageFetcher,
  DynamicPageFetcher,
  FailoverPageFetcher
} from "../_shared/strategies.ts";

// Type definitions
import type { 
  ScraperSource, 
  RawEventCard,
  CircuitBreakerState,
  DeadLetterItem,
  PipelineJob,
  PipelineStage
} from "../_shared/types.ts";

// Category mapping
import { 
  classifyTextToCategory, 
  INTERNAL_CATEGORIES, 
  type InternalCategory 
} from "../_shared/categoryMapping.ts";

// Rate limiting
import { jitteredDelay, isRateLimited } from "../_shared/rateLimiting.ts";

// Circuit breaker
import {
  isCircuitClosed,
  recordSuccess,
  recordFailure,
  getAvailableSources
} from "../_shared/circuitBreaker.ts";

// Dead letter queue
import {
  addToDLQ,
  getItemsReadyForRetry,
  markAsResolved
} from "../_shared/dlq.ts";

// Observability
import { 
  logScraperFailure, 
  getHistoricalEventCount 
} from "../_shared/scraperObservability.ts";

// Slack notifications
import { sendSlackNotification } from "../_shared/slack.ts";

// Error logging
import { 
  logError, 
  logWarning,
  withErrorLogging 
} from "../_shared/errorLogging.ts";
```

### ❌ Incorrect Imports (local duplicates - REMOVED)

```typescript
// DON'T: These files have been removed
import { parseToISODate } from "./dateUtils.ts";           // ❌ Removed
import { PageFetcher } from "./strategies.ts";             // ❌ Removed
import { ScraperSource } from "./shared.ts";               // ⚠️ Use _shared/types.ts instead
```

## Module Descriptions

### `_shared/strategies.ts`

**Purpose:** Provides abstractions for fetching HTML pages with different strategies (static HTTP, dynamic rendering with Puppeteer/Playwright/ScrapingBee).

**Key Exports:**
- `PageFetcher` interface - Abstract HTML fetching
- `StaticPageFetcher` - Standard HTTP requests with retry logic
- `DynamicPageFetcher` - Headless browser rendering
- `FailoverPageFetcher` - Automatic failover from static to dynamic
- `createFetcherForSource()` - Factory function for creating fetchers
- `ScraperStrategy` interface - Strategy pattern for parsing
- `DefaultStrategy` class - Default parsing implementation
- `resolveStrategy()` - Strategy resolver

**Usage Example:**
```typescript
import { createFetcherForSource } from "../_shared/strategies.ts";
import type { ScraperSource } from "../_shared/types.ts";

const source: ScraperSource = { /* ... */ };
const fetcher = createFetcherForSource(source);
const { html, finalUrl, statusCode } = await fetcher.fetchPage(url);
```

### `_shared/dateUtils.ts`

**Purpose:** Parse various date formats into ISO 8601 format.

**Key Exports:**
- `parseToISODate(dateStr, today?)` - Parse date string to YYYY-MM-DD

**Supported Formats:**
- ISO 8601: `2026-01-17`, `2026-01-17T10:00:00`
- Relative: `vandaag`, `today`, `morgen`, `tomorrow`
- European: `17/01/2026`, `17-01-2026`
- Textual: `17 januari 2026`, `January 17, 2026`

### `_shared/types.ts`

**Purpose:** Canonical type definitions for the entire scraper pipeline.

**Key Types:**
- `ScraperSource` - Source configuration
- `RawEventCard` - Parsed event data
- `PageFetcher` - Fetcher interface
- `CircuitBreakerState` - Circuit breaker state
- `DeadLetterItem` - DLQ item
- `PipelineJob` - Pipeline job
- `PipelineStage` - Pipeline stage enum
- `InternalCategory` - Event category enum

### `_shared/circuitBreaker.ts`

**Purpose:** Persistent circuit breaker pattern for source health management.

**Key Functions:**
- `isCircuitClosed()` - Check if source is available
- `recordSuccess()` - Record successful request
- `recordFailure()` - Record failed request (may open circuit)
- `getAvailableSources()` - Get all available sources

**Circuit States:**
- `CLOSED` - Normal operation
- `OPEN` - Circuit tripped, requests blocked
- `HALF_OPEN` - Probing recovery

### `_shared/dlq.ts`

**Purpose:** Dead Letter Queue for failed pipeline items.

**Key Functions:**
- `addToDLQ()` - Add failed item to queue
- `getItemsReadyForRetry()` - Get items ready for retry
- `markAsRetrying()` - Mark item as retrying
- `markAsResolved()` - Mark item as resolved
- `getDLQStats()` - Get queue statistics

### `_shared/rateLimiting.ts`

**Purpose:** Rate limiting utilities for polite web scraping.

**Key Functions:**
- `jitteredDelay()` - Delay with jitter
- `isRateLimited()` - Check if rate limited

### `_shared/categoryMapping.ts`

**Purpose:** Map text to internal event categories using rules and AI.

**Key Functions:**
- `classifyTextToCategory()` - Classify text to category
- `INTERNAL_CATEGORIES` - List of valid categories

### `_shared/scraperObservability.ts`

**Purpose:** Centralized observability and metrics for scraper operations.

**Key Functions:**
- `logScraperFailure()` - Log scraper failure
- `getHistoricalEventCount()` - Get event count for source

### `_shared/slack.ts`

**Purpose:** Slack notifications for scraper events.

**Key Functions:**
- `sendSlackNotification()` - Send notification to Slack

### `_shared/errorLogging.ts`

**Purpose:** Centralized error logging to Supabase.

**Key Functions:**
- `logError()` - Log error to database
- `logWarning()` - Log warning to database
- `withErrorLogging()` - Wrapper for error logging

## Migration Checklist

When creating a new Edge Function or updating an existing one:

- [ ] Import from `_shared/` modules, not local files
- [ ] Use `PageFetcher` interface for HTML fetching
- [ ] Use `parseToISODate()` for date parsing
- [ ] Import types from `_shared/types.ts`
- [ ] Use circuit breaker for source health management
- [ ] Use DLQ for failed items
- [ ] Log errors with `_shared/errorLogging.ts`
- [ ] Send notifications with `_shared/slack.ts`

## Architecture Benefits

1. **Single Source of Truth**: All shared logic in one place
2. **Consistent Interfaces**: PageFetcher pattern across all scrapers
3. **Resilience**: Circuit breaker and DLQ patterns built-in
4. **Observability**: Centralized logging and metrics
5. **Maintainability**: Update once, benefit everywhere

## Database Support

The shared modules integrate with the following database tables:

- `circuit_breaker_state` - Circuit breaker state
- `dead_letter_queue` - Failed items
- `scraper_sources` - Source configuration
- `error_logs` - Error logging
- `scraper_failures` - Scraper failures

See `supabase/migrations/20260116000000_resilient_pipeline_architecture.sql` for schema details.

## Testing

Test files should also import from `_shared/`:

```typescript
// ✅ Correct
import { parseToISODate } from "../_shared/dateUtils.ts";
import type { PageFetcher } from "../_shared/strategies.ts";

// Test code...
```

## Questions?

For questions or issues with shared modules, please refer to:

- `SCRAPER_ARCHITECTURE.md` - Overall architecture
- `AI_CONTEXT.md` - Quick reference for AI assistants
- Database migration files in `supabase/migrations/`
