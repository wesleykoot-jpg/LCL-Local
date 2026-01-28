# Discovery Rails Issue Analysis

## Problem Summary
Events appear on `/now` (Now page) but don't show in the horizontal rails on `/` (Discovery page).

## Root Causes Identified

### 1. **Date Filtering in Rails (CRITICAL)**
All rails except "For You" and "Saved for later" apply strict date filtering:

```typescript
// Rituals Rail
.filter((e) => e.event_date && new Date(e.event_date) >= new Date())

// This Weekend Rail  
.filter((e) => {
  if (!e.event_date) return false;
  // Must be within weekend date range
})

// Location Rail
.filter((e) => e.event_date && new Date(e.event_date) >= new Date())

// Pulse Rail
.filter((e) => 
  (e.attendee_count || 0) >= 2 && 
  e.event_date && 
  new Date(e.event_date) >= new Date()
)
```

**Issue**: If events have `event_date = null` or are in the past, they get filtered out!

### 2. **Event Status Filter**
In `useEventsQuery.ts`, the fallback query filters:
```typescript
.eq("status", "published")
```

**Issue**: If events are status='draft', they won't be fetched at all.

### 3. **Attendee Count Requirement**
Pulse rail requires `attendee_count >= 2`:
```typescript
.filter((e) => (e.attendee_count || 0) >= 2)
```

**Issue**: New or unpopular events won't show.

### 4. **Data Fetching Differences**

**Now page** (`useLiveEventsQuery`):
- Fetches with `gte("event_date", todayStr)`
- Filters events within time window (0-240 minutes from now)
- Shows ANY events with valid dates

**Discovery page** (`useEventsQuery`):
- Uses RPC: `get_personalized_feed` (if user has location + profile)
- Falls back to: `get_nearby_events` (if user has location)
- Falls back to: direct query with status='published'
- Then applies rail-specific filters that remove past/null-date events

## Why It Happens

1. **Event has null `event_date`** → filtered out of all rails except "For You"
2. **Event is status='draft'** → completely excluded from Discovery
3. **Event has 0-1 attendees** → won't show in Pulse rail
4. **Event date is in past** → filtered out by most rails

## The Now Page Works Because

The `useLiveEventsQuery` hook:
- Doesn't filter by status (no `.eq("status", "published")`)
- Has looser filtering: accepts events with null `event_time` as valid
- Focuses on time windows rather than strict rail logic
- Doesn't require attendee count

## Solutions to Check

1. **Verify event statuses**: Are events in the DB as 'published' or 'draft'?
2. **Verify event_date**: Are events missing `event_date` values?
3. **Check attendee counts**: Do events have attendees (needed for Pulse rail)?
4. **Compare dates**: Are events happening in the future?

## UI Behavior to Implement

When debugging, the Discovery page logs:
```javascript
[Discovery] Layout Debug: {
  allEventsLength: 0,  // ← If 0, no events fetched
  railsLoading: true,
  sectionsCount: 5,
  userLocation: {...}
}

[Discovery] Rail i: "Rail Title" (0 items)  // ← If 0, rail has no events
```

Check browser console for these logs!
