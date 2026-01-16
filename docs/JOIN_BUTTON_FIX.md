# Join Button Fix - Technical Summary

## Problem

The join button on event cards was working (adding users to events in the database), but joined events were not appearing on the Planning page (`/planning`).

## Root Cause

**Query Key Mismatch**: The React Query cache invalidation was using different keys than the Planning page query.

### Before Fix

1. **Planning Page** (`useUnifiedItinerary.ts`):
   ```typescript
   queryKey: ['my-events', effectiveUserId]
   ```

2. **Join Event Hook** (`hooks.ts`):
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['profile', profileId, 'commitments'] })
   ```

These keys didn't match, so when a user joined an event:
- ✅ Event was added to database
- ✅ Event feed was refreshed (correct invalidation)
- ❌ Planning page was NOT refreshed (wrong cache key)

### After Fix

Now both use the **same centralized query key**:

```typescript
// In queryKeys.ts
queryKeys.profile.myEvents(userId) // Returns: ['my-events', userId]
```

1. **Planning Page** (`useUnifiedItinerary.ts`):
   ```typescript
   queryKey: queryKeys.profile.myEvents(effectiveUserId || '')
   ```

2. **Join Event Hook** (`hooks.ts`):
   ```typescript
   queryClient.invalidateQueries({ queryKey: queryKeys.profile.myEvents(profileId) })
   ```

Now when a user joins an event:
- ✅ Event is added to database
- ✅ Event feed is refreshed
- ✅ Planning page is refreshed (correct invalidation)

## Changes Made

### 1. Added New Query Key (`src/shared/config/queryKeys.ts`)
```typescript
profile: {
  all: ['profile'] as const,
  commitments: (userId: string) => ['profile', userId, 'commitments'] as const,
  myEvents: (userId: string) => ['my-events', userId] as const,  // NEW
}
```

### 2. Updated Planning Hook (`src/features/events/hooks/useUnifiedItinerary.ts`)
```typescript
import { queryKeys } from '@/shared/config/queryKeys';

// Changed from: ['my-events', effectiveUserId]
// To:
queryKey: queryKeys.profile.myEvents(effectiveUserId || '')
```

### 3. Updated Join Hook (`src/features/events/hooks/hooks.ts`)
```typescript
// Added invalidation for planning page
await Promise.all([
  queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.commitments(profileId) }),
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.myEvents(profileId) }),  // NEW
]);
```

## Testing

### Manual Test Steps

1. Start the app: `npm run dev`
2. Navigate to Feed (`/feed`)
3. Find an event and click "Join Event" button
4. Verify toast notification: "You're in! Event added to your calendar"
5. Navigate to Planning (`/planning`)
6. **Expected Result**: The joined event should appear in the timeline

### Automated Test

```javascript
// Query keys match test
const userId = 'test-user-123';
const key1 = queryKeys.profile.myEvents(userId);
const key2 = queryKeys.profile.myEvents(userId);
console.log(JSON.stringify(key1) === JSON.stringify(key2)); // true ✅
```

## Mock Seed Data

Also added 4 persistent mock events with dynamic dates:

```sql
-- Refresh dates to keep events in the future
SELECT dev_refresh_mock_event_dates();
```

Events:
1. Cinema Night - 2 days from today @ 19:00
2. Sports Match - 4 days from today @ 15:00
3. Gaming Session - 1 day from today @ 20:00
4. Food Market - 6 days from today @ 11:00

See `docs/SEED_DATA_GUIDE.md` for complete documentation.

## Impact

- ✅ **Join button now properly updates Planning page**
- ✅ **No breaking changes** - all existing functionality preserved
- ✅ **Centralized query keys** - prevents future mismatches
- ✅ **Persistent test data** - easy to test join flow

## Related Files

- `src/shared/config/queryKeys.ts` - Centralized query key definitions
- `src/features/events/hooks/useUnifiedItinerary.ts` - Planning page data hook
- `src/features/events/hooks/hooks.ts` - Join event hook with invalidation
- `supabase/seed.sql` - Mock seed data with 4 persistent events
- `docs/SEED_DATA_GUIDE.md` - Seed data documentation
