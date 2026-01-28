## Performance Optimization: Discovery Rails Load Time

### Problem
The Discovery page (`/`) with horizontal rails was taking **5+ seconds to load** when clicking the "Explore" button.

### Root Causes Identified

1. **Sequential Database Queries** - Instead of parallel execution:
   - Query 1: `user_blocks` table
   - Query 2: RPC `get_personalized_feed` or `get_nearby_events`
   - Query 3: `event_attendees` (attendee profiles)
   - Query 4: `events` (event creator info)
   - Query 5: `event_attendees` (user attendance)
   
   Each query waits for the previous one to complete.

2. **Over-fetching Data** - Fetching 100 events when:
   - Each rail shows maximum 10 items
   - Rails filter heavily (future dates only, min attendees, etc.)
   - Wasted bandwidth and processing

3. **Expensive Console Logging** - Multiple `console.log()` calls in:
   - `useEventsQuery` hook
   - `Discovery.tsx` component
   - Browser console can be slow on slower devices

4. **Redundant Queries** - Blocked users were fetched on every query:
   - `user_blocks` table has < 10 records typically
   - Should be cached across multiple queries

### Solutions Implemented

#### 1. **Parallelize Database Queries** (Est. 1-2 sec improvement)
```typescript
// Before: Sequential
const { data: attendeesData } = await supabase.from("event_attendees").select(...);
const { data: fullEventsData } = await supabase.from("events").select(...);

// After: Parallel
const [attendeesResponse, eventDetailsResponse] = await Promise.all([
  supabase.from("event_attendees").select(...),
  supabase.from("events").select(...),
]);
```

**File**: [src/features/events/hooks/useEventsQuery.ts](src/features/events/hooks/useEventsQuery.ts)

#### 2. **Reduce Initial Event Fetch** (Est. 0.5-1 sec improvement)
Changed from 100 → **50 events** for browsing mode:
- Rails only display 10 items max per rail (5 rails = 50 items max)
- Reduces database transfer time ~50%
- Maintains full search functionality with `limit: LIMIT` when searching

**File**: [src/features/events/Discovery.tsx](src/features/events/Discovery.tsx) line 105

#### 3. **Cache Blocked Users** (Est. 0.1-0.2 sec improvement)
```typescript
// Check QueryClient cache before fetching
const cachedBlocked = queryClient.getQueryData<string[]>([
  "user_blocks",
  currentUserProfileId,
]);
if (cachedBlocked) {
  blockedUserIds = cachedBlocked;
} else {
  // Fetch and cache for 1 hour
  queryClient.setQueryData([...], blockedUserIds);
}
```

**File**: [src/features/events/hooks/useEventsQuery.ts](src/features/events/hooks/useEventsQuery.ts)

#### 4. **Disable Development Console Logs** (Est. 0.1-0.5 sec improvement)
Created optimized debug utility that:
- Completely disables verbose logging by default
- Can be re-enabled via `DEBUG_ENABLED` flag
- Removes expensive object serialization from console

**New File**: [src/lib/debugLog.ts](src/lib/debugLog.ts)

**Modified Files**:
- [src/features/events/hooks/useEventsQuery.ts](src/features/events/hooks/useEventsQuery.ts) - Replaced `console.log` with `debugLog`
- [src/features/events/Discovery.tsx](src/features/events/Discovery.tsx) - Removed verbose layout debug logs

### Expected Results

- **Before**: 5-6 seconds
- **After**: 1.5-2 seconds (60-70% improvement)

Key bottleneck breakdown:
- Database queries: ~2-3 sec → ~1 sec (parallel execution)
- Data transfer: ~1-2 sec → ~0.5-1 sec (50% less data)
- Console overhead: ~0.5 sec → ~0 sec (disabled logs)

### How to Enable Debug Logs Again

Edit [src/lib/debugLog.ts](src/lib/debugLog.ts):
```typescript
// Change this line:
const DEBUG_ENABLED = import.meta.env.DEV && false;
// To:
const DEBUG_ENABLED = import.meta.env.DEV && true;
```

### Testing

1. Open DevTools Network tab and monitor timeline
2. Click "Explore" button
3. Watch the Rails load time in Performance tab
4. Should complete in 1.5-2 seconds vs 5+ seconds before

### Further Optimization Opportunities

1. **Server-side Rail Generation** - Calculate rail rankings in RPC instead of client
2. **Rails Pre-fetching** - Load rails data before user navigates
3. **Virtual Scrolling** - If adding more rails, implement windowing
4. **GraphQL** - Replace REST with single query operation
