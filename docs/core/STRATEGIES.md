# Scraper Strategies

This codebase implements the Strategy Pattern for event scraping in two distinct locations. It is critical to understand the difference when getting context or making changes.

## 1. Production Strategies (`supabase/functions/scrape-events/strategies/`)

**Location**: `supabase/functions/scrape-events/strategies/`
**Purpose**: These are the *actual* strategies used by the Scraper Edge Function in production.
**Usage**: The `scrape-events` function resolves these strategies based on the source configuration.

**Key Files**:
- `base.ts`: Defines the `ScraperStrategy` interface and base classes.
- `culture.ts`, `dining.ts`, `nightlife.ts`, etc.: Specific implementations for different event types.

## 2. Test Strategies (`strategies/`)

**Location**: `strategies/` (Project Root)
**Purpose**: These strategies are used **only for testing** and local validation. They mirror the structure of production strategies but are simplified for use in the `tests/` directory.
**Usage**: Used by `tests/scraper_unit_test.ts` and other integration tests to validate scraping logic without deploying to Supabase.

**Key Files**:
- `BaseStrategy.ts`: Test-specific interface definition.
- `DefaultStrategy.ts`: A generic implementation for testing.

## Summary

| Location | Purpose | Environment |
|----------|---------|-------------|
| `supabase/functions/scrape-events/strategies/` | **Real Scraping Logic** | Production (Edge Functions) |
| `strategies/` | **Testing & Validation** | Local (Unit/Integration Tests) |

> [!IMPORTANT]
> When modifying scraping logic, you likely need to update **BOTH**:
> 1. The production strategy in `supabase/functions/` to apply the fix.
> 2. The test strategy in `strategies/` (or the tests themselves) to verify the behavior locally.
