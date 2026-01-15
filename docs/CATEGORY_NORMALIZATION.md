# Category Normalization Requirements

## Overview

This document describes the category validation and normalization system that ensures all events in the database have valid categories that match the database constraint.

## Database Constraint

The `events` table has a check constraint `events_category_check` that only allows these 10 categories:

```sql
CHECK (category = ANY (ARRAY[
  'active',
  'gaming', 
  'entertainment',
  'social',
  'family',
  'outdoors',
  'music',
  'workshops',
  'foodie',
  'community'
]))
```

**Location**: `supabase/migrations/20260114160000_update_category_constraint_modern.sql`

## Category System Components

### 1. Category Definitions (`supabase/functions/_shared/categoryMapping.ts`)

This file contains:
- `INTERNAL_CATEGORIES`: Constant array of the 10 allowed categories
- `CATEGORIES`: Full category definitions with Dutch/English labels and keywords
- `classifyTextToCategory()`: Main classification function using keyword matching
- Special keyword lists for "Hybrid Life" persona logic

### 2. Category Validation Flow

```
Raw event text (title/description)
    ↓
classifyTextToCategory(text)
    - Null/undefined check → "community"
    - Dutch family keywords check → "family"
    - Dutch social keywords check → "social" or "foodie"
    - Keyword matching against all categories
    - Default fallback → "community"
    ↓
mapToInternalCategory(input)
    - Call classifyTextToCategory()
    - Validate result is in INTERNAL_CATEGORIES
    - Log warning if invalid
    - Default fallback → "community"
    ↓
ensureValidCategory(category)
    - Final validation before database insert
    - Check against INTERNAL_CATEGORIES
    - Log warning if invalid
    - Default fallback → "community"
    ↓
Database INSERT (constraint validation)
```

### 3. Defense Layers

| Layer | Function | Purpose |
|-------|----------|---------|
| 1 | `classifyTextToCategory()` | Keyword-based classification with default fallback |
| 2 | `mapToInternalCategory()` | Validation against whitelist with logging |
| 3 | `ensureValidCategory()` | Final defensive check before database |
| 4 | Database constraint | Hard enforcement at data layer |

## Implementation Details

### Classification Logic

**Hybrid Life Priority Keywords** (highest priority):
- Dutch family keywords (basisschool, kinderopvang, peutergroep, etc.) → `family`
- Dutch social keywords (borrel, vrijmibo, netwerken, proeverij, etc.) → `social` or `foodie`

**Standard Keyword Matching** (second priority):
- Each category has Dutch and English keywords
- First match wins
- Case-insensitive matching

**Default Fallback** (lowest priority):
- If no keywords match → `community`
- If input is null/undefined/empty → `community`

### Error Handling

All category functions handle these edge cases:
- `null` or `undefined` input → `community`
- Empty string or whitespace → `community`
- Gibberish or unrecognized text → `community`
- Very long strings (10,000+ chars) → processed normally
- Special characters/emojis → processed normally

### Logging

**Warning logs are emitted for**:
1. `classifyTextToCategory()` returns unexpected value (not in INTERNAL_CATEGORIES)
2. `ensureValidCategory()` receives invalid category value
3. Database insert fails with constraint violation (error code 23514)

**Enhanced error logging includes**:
- Event title
- Attempted category value
- List of valid categories
- Error code and message

## Testing

### Test Coverage (`tests/category_validation.test.ts`)

15 test cases covering:
- Category constant validation (count, values, no legacy categories)
- Edge cases (null, undefined, empty, whitespace, gibberish)
- Dutch keyword handling
- Hybrid Life priority logic
- Special characters and very long inputs
- Mixed case handling

**All tests must pass before deployment.**

## Migration Checklist

When adding or modifying categories:

1. **Update database migration**
   - Modify or create migration file to update constraint
   - Apply to all environments

2. **Update `categoryMapping.ts`**
   - Update `INTERNAL_CATEGORIES` constant
   - Update `CATEGORIES` array with keywords
   - Update keyword matching logic if needed

3. **Update tests**
   - Update `tests/category_validation.test.ts`
   - Ensure all tests pass

4. **Update documentation**
   - Update this document
   - Update AI_CONTEXT.md if categories change

5. **Verify deployment**
   - Check scraper logs for warnings
   - Monitor error rates for constraint violations
   - Verify existing events still display correctly

## Troubleshooting

### "CHECK CONSTRAINT VIOLATION" errors in logs

**Symptoms**: Insert failures with error code 23514

**Possible causes**:
1. Category mapping returned unexpected value
2. Old code deployed without latest fixes
3. Migration not applied to database

**Resolution**:
1. Check logs for "Invalid category detected" warnings
2. Verify database constraint matches `INTERNAL_CATEGORIES`
3. Ensure latest scraper code is deployed
4. Check if migration was applied: `SELECT * FROM events LIMIT 1;` should work with new categories

### Events assigned wrong category

**Symptoms**: Family events showing as social, sports events as active, etc.

**Resolution**:
1. Check if keywords need updating in `categoryMapping.ts`
2. Verify Hybrid Life priority keywords are correct
3. Add missing keywords to appropriate category
4. Test with `classifyTextToCategory()` function

### All events defaulting to "community"

**Symptoms**: No keyword matching working

**Possible causes**:
1. Input text is empty or gibberish
2. Keywords not matching due to language differences
3. Input text preprocessing removing keywords

**Resolution**:
1. Check raw event titles/descriptions in logs
2. Verify keywords include common variations
3. Test classification with actual event text samples

## Related Files

- `supabase/functions/_shared/categoryMapping.ts` - Category definitions and classification
- `supabase/functions/scrape-events/index.ts` - Scraper implementation
- `supabase/migrations/20260114160000_update_category_constraint_modern.sql` - Database constraint
- `tests/category_validation.test.ts` - Test suite
- `AI_CONTEXT.md` - High-level overview
- `src/lib/categories.ts` - Frontend category configuration (should match backend)

## Monitoring

### Key Metrics to Track

1. **Constraint violation rate**
   - Query: Count of error code 23514 in logs
   - Target: 0 violations

2. **Category distribution**
   - Query: `SELECT category, COUNT(*) FROM events GROUP BY category;`
   - Should see reasonable distribution, not all "community"

3. **Warning log frequency**
   - "Invalid category detected" warnings
   - "classifyTextToCategory returned unexpected value" warnings
   - Target: 0 warnings in production

### Alerts

Set up alerts for:
- Any constraint violation errors (23514)
- Sudden spike in "community" category usage
- Repeated warnings from category validation

## Contact

For questions or issues related to category normalization:
- Check logs in Supabase Dashboard
- Review test results in CI/CD pipeline
- Consult this documentation
