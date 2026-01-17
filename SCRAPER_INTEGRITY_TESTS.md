# Scraper Integrity Test Suite

## Overview

This test suite validates the scraper's resilience, failover mechanisms, rate limiting handling, and data accuracy (especially Soccer categorization).

## Architecture

The test logic is **shared** between CLI tests and Admin UI:

```
supabase/functions/scrape-events/testLogic.ts  ← Shared test logic
        ↓                                    ↓
    CLI Tests                          Admin UI Button
(tests/scraper_e2e_comprehensive_test.ts)  (Admin panel)
```

## Test Scenarios

### 1. Soccer Categorization ⚽
- **Purpose**: Validates that soccer/football events are correctly categorized as "active"
- **Test Cases**:
  - "Ajax vs Feyenoord" → active
  - "voetbalwedstrijd" → active  
  - "Football game at stadium" → active
  - "Soccer tournament finals" → active
  - "Tennis match" → active
  - "Music concert" → entertainment

### 2. Failover Strategy 🔄
- **Purpose**: Validates retry logic and failover mechanisms
- **Test**: Simulates failures and ensures the system retries before succeeding
- **Validates**: FailoverPageFetcher switches strategies after 3 failures

### 3. Rate Limiting (429) Handling ⏱️
- **Purpose**: Validates graceful handling of rate limit responses
- **Test**: Simulates 429 status codes and ensures proper backoff/retry
- **Validates**: System doesn't crash on rate limiting

### 4. 404 Handling 🔍
- **Purpose**: Validates graceful handling of missing pages
- **Test**: Simulates 404 responses
- **Validates**: System doesn't crash on 404s

### 5. Time Parsing 🕐
- **Purpose**: Validates various time format parsing
- **Test Cases**:
  - "20:00" → parsed correctly
  - "TBD" → handled
  - "hele dag" → all-day event
  - "avond" → evening time
  - "14:30" → specific time

### 6. Idempotency 🔐
- **Purpose**: Validates fingerprinting prevents duplicate events
- **Test**: Ensures same event produces same fingerprint, different events produce different fingerprints
- **Validates**: Duplicate detection works correctly

## Usage

### Admin UI (Production)

1. Navigate to `/admin` in the application
2. Scroll to the "Scraper Integrity Tests" section
3. Click "Run Scraper Integrity Test"
4. View results showing Pass/Fail for each test
5. Expand details to see specific failures

**Screenshot**:
```
┌────────────────────────────────────────┐
│ Scraper Integrity Tests                │
│                                         │
│ [Run Scraper Integrity Test] button    │
│                                         │
│ Results:                                │
│ ✅ Soccer Categorization: PASS          │
│ ✅ Failover Strategy: PASS              │
│ ✅ Rate Limiting Handling: PASS         │
│ ✅ 404 Handling: PASS                   │
│ ✅ Time Parsing: PASS                   │
│ ✅ Idempotency: PASS                    │
└────────────────────────────────────────┘
```

### CLI (CI/CD)

**Option 1: Using Deno (Recommended)**
```bash
deno test tests/scraper_e2e_comprehensive_test.ts --allow-all
```

**Option 2: Using simple Node.js test**
```bash
node test-soccer-categorization.js
```

### Edge Function Direct Call

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/scrape-events" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "run-integrity-test"}'
```

**Response Format**:
```json
{
  "success": true,
  "timestamp": "2026-01-17T11:30:00.000Z",
  "results": [
    {
      "test": "Soccer Categorization",
      "status": "PASS",
      "message": "All 6 test cases passed",
      "details": { "passed": 6, "failed": 0 }
    },
    {
      "test": "Failover Strategy",
      "status": "PASS",
      "message": "Failover logic is operational"
    }
  ],
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0
  }
}
```

## Key Features

### ✅ No Test Pollution
- Tests use **mock fetchers** only - no real HTTP requests
- **No database writes** during test execution
- Completely safe to run in production environment

### ✅ Unified Logic
- Same test code runs in CLI and Admin UI
- Ensures consistency between environments
- Single source of truth for test scenarios

### ✅ Self-Healing Verification
- Validates failover after 3 failures
- Tests retry logic with exponential backoff
- Confirms rate limiting doesn't crash the system

### ✅ Data Integrity
- Soccer events correctly categorized as "active"
- Time parsing handles various formats
- Fingerprinting prevents duplicate events

## Code Remediation Done

### Soccer Categorization Fix
**Problem**: Soccer/football keywords were missing from category mapping

**Fix**: Added to `supabase/functions/_shared/categoryMapping.ts`:
```typescript
keywordsNL: [..., "voetbal", "voetbalwedstrijd", "ajax", "feyenoord", "psv", ...]
keywordsEN: [..., "soccer", "football", ...]
```

**Result**: All soccer test cases now pass ✅

## Integration Points

### Frontend
- File: `src/features/admin/Admin.tsx`
- Function: `handleRunIntegrityTests()`
- Service: `src/features/admin/api/scraperService.ts::runScraperTests()`

### Backend
- File: `supabase/functions/scrape-events/index.ts`
- Handler: Accepts `{ "action": "run-integrity-test" }`
- Logic: `supabase/functions/scrape-events/testLogic.ts::runScraperIntegrityTest()`

### CLI
- File: `tests/scraper_e2e_comprehensive_test.ts`
- Imports: Same `testLogic.ts` functions

## Development

### Adding New Tests

1. Add test function to `testLogic.ts`:
```typescript
export async function testNewScenario(): Promise<TestResult> {
  try {
    // Test logic here
    return {
      test: "New Test Name",
      status: "PASS",
      message: "Test passed successfully"
    };
  } catch (error) {
    return {
      test: "New Test Name",
      status: "FAIL",
      message: error.message
    };
  }
}
```

2. Add to `runScraperIntegrityTest()`:
```typescript
results.push(await testNewScenario());
```

3. Test will automatically appear in both CLI and Admin UI

### Troubleshooting

**Test fails in Admin UI but passes in CLI**:
- Check browser console for errors
- Verify Supabase edge function is deployed
- Check network tab for edge function response

**All tests show as FAIL**:
- Check if edge function is reachable
- Verify authentication tokens
- Check Supabase logs for errors

**Soccer categorization fails**:
- Verify `categoryMapping.ts` has soccer keywords
- Check that `classifyTextToCategory()` is being called
- Inspect test input strings

## Maintenance

### When to Run Tests

- **Before deploying scraper changes**: Ensure logic still works
- **After adding new categories**: Verify categorization logic
- **When debugging scraper issues**: Identify which component is failing
- **During code reviews**: Validate changes don't break existing functionality

### CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Scraper Tests
  run: deno test tests/scraper_e2e_comprehensive_test.ts --allow-all
```

Or use Node.js version:
```yaml
- name: Run Soccer Categorization Test
  run: node test-soccer-categorization.js
```

## Success Criteria ✅

- ✅ All 6 tests pass in both CLI and Admin UI
- ✅ Soccer events categorized as "active"
- ✅ Retry system handles failures gracefully
- ✅ Rate limiting doesn't crash the system
- ✅ 404s handled without errors
- ✅ Time parsing works for various formats
- ✅ Fingerprinting prevents duplicates
- ✅ No test data written to production database
- ✅ UI shows clear Pass/Fail indicators
