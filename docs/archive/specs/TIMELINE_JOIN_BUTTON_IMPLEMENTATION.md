# TimelineEventCard Join Button Implementation Summary

## Overview
This document explains the implementation of the join button functionality in `TimelineEventCard` component, which provides instant visual feedback and automatically updates the "My Events" list through React Query cache invalidation.

## Changes Made

### 1. TimelineEventCard Component (`src/features/events/components/TimelineEventCard.tsx`)

#### Added Imports
- `Loader2` from `lucide-react` for loading spinner
- `useJoinEvent` hook from local hooks
- `useAuth` hook from auth feature

#### New Prop
- `showJoinButton?: boolean` (default: `false`)
  - When `true`, displays join button for events
  - When `false`, hides join button (used in MyEvents where users have already joined)

#### Join Button States
The button has three distinct visual states:

1. **Not Joined** (Default State)
   - Primary colored button
   - Text: "Join Event"
   - Enabled and clickable

2. **Loading** (During Join Operation)
   - Disabled state
   - Muted background color
   - Shows spinner icon with "Joining..." text
   - Prevents multiple clicks

3. **Already Joined** (Success State)
   - Secondary colored background with primary border
   - Text: "✓ Going"
   - Not interactive (shows status only)

#### User Flow
1. User clicks "Join Event" button
2. Button immediately changes to loading state (spinner + "Joining...")
3. `useJoinEvent` hook is called:
   - Checks if user is already attending
   - Calls `eventService.joinEvent()`
   - Handles waitlist logic if event is full
   - Triggers success haptic feedback
   - Shows success toast notification
   - Invalidates React Query caches
4. Button changes to "✓ Going" state
5. MyEvents page automatically updates (via query invalidation)

### 2. Integration with Existing Infrastructure

#### useJoinEvent Hook (`src/features/events/hooks/hooks.ts`)
This hook (lines 384-465) already provides:
- Loading state management via `joiningEvents` Set
- Attendance checking to prevent duplicate joins
- Waitlist handling for full events
- Haptic feedback on success/warning/error
- Toast notifications for user feedback
- Query invalidation for automatic UI updates

#### Query Invalidation
When a user joins an event, the hook invalidates:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
queryClient.invalidateQueries({ queryKey: queryKeys.profile.commitments(profileId) })
```

This ensures:
- **Feed page** (`queryKeys.events.all`) shows updated attendance counts
- **MyEvents page** (`queryKeys.profile.commitments(profileId)`) automatically includes the newly joined event

#### Service Layer (`src/features/events/api/eventService.ts`)
The `joinEvent` function handles:
- Capacity checking and automatic waitlist assignment
- Direct insertion to `event_attendees` table
- Fallback to RPC `join_event_atomic` for strict RLS scenarios
- Proper error handling and informative error messages

### 3. Test Coverage

Created `src/features/events/components/__tests__/TimelineEventCard.test.tsx` with 5 tests:
- ✅ Renders event details correctly
- ✅ Hides join button by default
- ✅ Shows join button when `showJoinButton={true}`
- ✅ Displays ticket number when present
- ✅ Applies past event styling correctly

All tests pass.

## Usage Examples

### In MyEvents (Current Usage)
```tsx
<TimelineEventCard 
  event={event} 
  isPast={isPast}
  // showJoinButton is false by default, no button shown
/>
```

### In Discovery/Browse Context (Future Usage)
```tsx
<TimelineEventCard 
  event={event} 
  isPast={false}
  showJoinButton={true}  // Enable join button
/>
```

## Real-Time Updates Flow

```
User clicks "Join Event"
  ↓
useJoinEvent.handleJoinEvent(eventId)
  ↓
eventService.joinEvent({ eventId, profileId })
  ↓
Supabase: INSERT into event_attendees
  ↓
Success Response
  ↓
Haptic Feedback (success vibration)
  ↓
Toast Notification ("You're in!")
  ↓
Query Invalidation
  ├─ queryKeys.events.all (Feed updates)
  └─ queryKeys.profile.commitments(profileId) (MyEvents updates)
  ↓
React Query refetches data
  ↓
UI automatically updates across all pages
```

## Key Design Decisions

1. **Opt-in Join Button**: The `showJoinButton` prop defaults to `false` to maintain backward compatibility. TimelineEventCard is primarily used in MyEvents where users have already joined, so the button is hidden by default.

2. **Reused Existing Hook**: Instead of creating a new mutation, we reused the existing `useJoinEvent` hook which already implements all required logic (loading states, haptics, toasts, query invalidation).

3. **Proper Event Propagation**: The button uses `e.stopPropagation()` to prevent card click events when clicking the join button.

4. **Loading State per Event**: The `isJoining(eventId)` check ensures each card shows its own loading state independently.

5. **Visual Feedback**: Three distinct button states provide clear user feedback at every stage of the join process.

## Future Enhancements

Potential improvements for future iterations:
- Add "Leave Event" functionality
- Support for "Interested" status (not just "Going")
- Show position in waitlist when event is full
- Animated transition between button states
- Optimistic UI updates before server confirmation

## Security Considerations

- ✅ RLS policies enforced via Supabase
- ✅ User authentication checked before allowing join
- ✅ Duplicate join attempts prevented
- ✅ Capacity limits respected with automatic waitlist
- ✅ Profile ID validation

## Performance

- Query invalidation is efficient (only relevant queries)
- Loading state prevents duplicate API calls
- Event propagation properly handled
- No unnecessary re-renders (memoized component)
