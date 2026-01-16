# Join Button Flow - Before and After

## Before Fix ❌

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks "Join Event" on Feed                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ useJoinEvent hook executes                                   │
│ - Calls joinEvent() API                                      │
│ - Adds event_attendee record to DB                           │
│ - Shows success toast                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Query Cache Invalidation                                     │
│                                                              │
│ ✅ queryClient.invalidateQueries(['events'])                │
│    → Feed refreshes (works)                                  │
│                                                              │
│ ✅ queryClient.invalidateQueries(['profile', id, 'commits']) │
│    → Profile commitments refresh (works)                     │
│                                                              │
│ ❌ Planning page uses ['my-events', id]                     │
│    → NOT INVALIDATED → Stale data                           │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User navigates to Planning page                              │
│                                                              │
│ Result: Event NOT shown (uses stale cache) ❌               │
└─────────────────────────────────────────────────────────────┘
```

## After Fix ✅

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks "Join Event" on Feed                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ useJoinEvent hook executes                                   │
│ - Calls joinEvent() API                                      │
│ - Adds event_attendee record to DB                           │
│ - Shows success toast                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Query Cache Invalidation (Now Complete!)                     │
│                                                              │
│ ✅ queryClient.invalidateQueries(['events'])                │
│    → Feed refreshes                                          │
│                                                              │
│ ✅ queryClient.invalidateQueries(['profile', id, 'commits']) │
│    → Profile commitments refresh                             │
│                                                              │
│ ✅ queryClient.invalidateQueries(['my-events', id])         │
│    → Planning page refreshes (NEW!)                          │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User navigates to Planning page                              │
│                                                              │
│ Result: Event shown in timeline! ✅                         │
└─────────────────────────────────────────────────────────────┘
```

## Key Code Changes

### 1. Centralized Query Key Definition

```typescript
// src/shared/config/queryKeys.ts
export const queryKeys = {
  profile: {
    commitments: (userId: string) => ['profile', userId, 'commitments'],
    myEvents: (userId: string) => ['my-events', userId],  // NEW ✨
  },
};
```

### 2. Planning Page Uses Standardized Key

```typescript
// src/features/events/hooks/useUnifiedItinerary.ts
const { data: myEvents } = useQuery({
  queryKey: queryKeys.profile.myEvents(effectiveUserId || ''),  // ✨
  queryFn: () => eventService.fetchUserEvents(effectiveUserId),
});
```

### 3. Join Hook Invalidates Correct Key

```typescript
// src/features/events/hooks/hooks.ts
await Promise.all([
  queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.commitments(profileId) }),
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.myEvents(profileId) }),  // NEW ✨
]);
```

## React Query Cache States

### Before Fix

```
Query Cache State:
{
  ['events']: { data: [...], fresh: false },
  ['profile', '123', 'commitments']: { data: [...], fresh: false },
  ['my-events', '123']: { data: [...], fresh: true }  ← STALE! ❌
}
```

### After Fix

```
Query Cache State:
{
  ['events']: { data: [...], fresh: false },
  ['profile', '123', 'commitments']: { data: [...], fresh: false },
  ['my-events', '123']: { data: [...], fresh: false }  ← INVALIDATED! ✅
}
                                                         ↓
                                                    AUTO-REFETCH
                                                         ↓
{
  ['events']: { data: [...], fresh: true },
  ['profile', '123', 'commitments']: { data: [...], fresh: true },
  ['my-events', '123']: { data: [..., NEW_EVENT], fresh: true }  ← FRESH! ✅
}
```

## Testing Checklist

- [ ] Join an event from Feed page
- [ ] Verify success toast appears
- [ ] Navigate to Planning page (`/planning`)
- [ ] Verify joined event appears in timeline
- [ ] Verify event shows correct date/time
- [ ] Verify event shows attendee count
- [ ] Check browser console for no errors

## Debugging

If events still don't appear in Planning:

1. **Check React Query DevTools**
   ```bash
   # Add to browser console
   window.localStorage.setItem('debug', 'react-query')
   ```

2. **Verify Query Keys Match**
   ```typescript
   console.log('Planning key:', queryKeys.profile.myEvents('123'));
   console.log('Invalidate key:', queryKeys.profile.myEvents('123'));
   // Should be identical: ['my-events', '123']
   ```

3. **Check Database**
   ```sql
   SELECT * FROM event_attendees WHERE profile_id = '11111111-1111-1111-1111-111111111111';
   ```

4. **Force Cache Clear**
   ```typescript
   queryClient.clear(); // Nuclear option - clears entire cache
   ```
