# My Events Fix - Investigation and Resolution

## Problem Statement
Events from Supabase were not showing in the "My Events" page when viewing the app in Lovable.dev.

## Root Cause Analysis

### Issue #1: Profile UUID Mismatch
The initial database schema migration (`20260109032347_create_lcl_social_app_schema.sql`) creates a test profile "Alex van Berg" with a **random UUID** using `gen_random_uuid()`:

```sql
v_profile_id uuid := gen_random_uuid();
```

However, the frontend code (`src/pages/MyEvents.tsx`) uses a **hardcoded UUID** for the dev test profile:

```typescript
const DEV_TEST_PROFILE_ID = 'de595401-5c4f-40fc-8d3a-a627e49780ff';
```

**Impact**: The query in `useAllUserCommitments` hook filters by `profile_id`, but the profile with the expected UUID doesn't exist in the database, resulting in zero results.

### Issue #2: Event UUID Mismatch
A later migration (`20260113233828_8a0e06c3-b8bf-4b4e-9e9d-4e4fa02cd151.sql`) inserts event attendees for specific event UUIDs:

```sql
INSERT INTO event_attendees (profile_id, event_id, status, ticket_number) VALUES
('de595401-5c4f-40fc-8d3a-a627e49780ff', 'adb96d9e-60f5-49f0-a855-61ace082fc45', 'going', 'TKT-001'),
('de595401-5c4f-40fc-8d3a-a627e49780ff', '2a9aefb0-82a5-42b1-b715-819f48b5d362', 'going', 'TKT-002'),
-- ... etc
```

But the events with these UUIDs were never created in any migration, as the initial migration also uses `gen_random_uuid()` for event IDs.

**Impact**: Even if the profile existed, the foreign key constraints would fail or the events wouldn't be joinable.

## Solution

Created a new migration `20260114000000_fix_test_profile_uuid.sql` that:

1. **Creates or migrates the test profile** with the expected UUID `de595401-5c4f-40fc-8d3a-a627e49780ff`
2. **Creates 5 test events** with the specific UUIDs referenced in the event_attendees migration
3. **Creates additional test profiles** for other attendees to make the events look realistic
4. **Uses relative dates** (CURRENT_DATE + intervals) so events are always in the future

### Migration Logic

The migration is idempotent and handles three scenarios:

1. **Profile already exists with correct UUID**: Do nothing
2. **Profile exists with different UUID**: Migrate it by updating all foreign keys and the profile ID itself
3. **Profile doesn't exist**: Create it with the correct UUID

For events, it checks if each event already exists before inserting to avoid duplicates.

## Timeline Implementation Analysis

The timeline implementation was already correct and working as designed:

### 1. Data Fetching (`useAllUserCommitments` hook)
```typescript
const { data, error } = await supabase
  .from('event_attendees')
  .select(`
    *,
    event:events(
      *,
      attendee_count:event_attendees(count)
    )
  `)
  .eq('profile_id', profileId)
  .eq('status', 'going');
```

- Queries `event_attendees` table filtered by user's profile ID
- Joins with `events` table to get full event details
- Aggregates attendee count for each event
- Groups events by month/year using locale-specific formatting

### 2. Filtering (`MyEvents.tsx`)
```typescript
const filteredGrouped = Object.entries(groupedByMonth).reduce((acc, [month, events]) => {
  const filtered = events.filter(event => {
    const eventDate = new Date(event.event_date.split('T')[0] + 'T00:00:00');
    if (activeTab === 'upcoming') {
      return eventDate >= today;
    } else {
      return eventDate < today;
    }
  });
  if (filtered.length > 0) {
    acc[month] = filtered;
  }
  return acc;
}, {} as typeof groupedByMonth);
```

- Correctly normalizes dates to midnight for comparison
- Separates events into "upcoming" (>= today) and "past" (< today)
- Removes months with no events after filtering

### 3. Timeline Display (`EventTimeline` component)

```typescript
function groupEventsByDay(events: Array<EventWithAttendees & { ticket_number?: string }>): DayGroupedEvents {
  const grouped: DayGroupedEvents = {};
  
  events.forEach(event => {
    const dateKey = event.event_date.split('T')[0].split(' ')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(event);
  });
  
  return grouped;
}
```

- Groups events by day within each month
- Sorts days chronologically
- Detects "today" and highlights it with a "NOW" badge
- Applies reduced opacity and muted colors to past events
- Uses smooth animations for better UX

### 4. Event Card Display (`TimelineEventCard` component)

Each event card shows:
- Event time (formatted as "7:00 PM")
- Event title (truncated if too long)
- Venue name
- Category (cinema, sports, crafts, gaming, market)
- Attendee count
- Optional ticket number badge

## Testing Checklist

To verify the fix works:

1. **Database Migration**
   - [ ] Run Supabase migrations (automatic in Lovable.dev)
   - [ ] Verify profile `de595401-5c4f-40fc-8d3a-a627e49780ff` exists
   - [ ] Verify 5 test events exist with correct UUIDs
   - [ ] Verify event_attendees records link profile to events

2. **Frontend Behavior**
   - [ ] Navigate to "My Events" page
   - [ ] Verify events are displayed (not empty state)
   - [ ] Verify events are grouped by month header
   - [ ] Verify events are grouped by day within month
   - [ ] Verify "Upcoming" tab shows future events
   - [ ] Verify "Past" tab is empty (or shows past events if any)
   - [ ] Verify clicking calendar icon works (if implemented)
   - [ ] Verify "Browse Events" button navigates to feed

3. **Timeline Display**
   - [ ] Month headers show "January 2026" (or current month)
   - [ ] Day headers show "Tuesday, January 14" format
   - [ ] Events on current day show "Today" with "NOW" badge
   - [ ] Past events have reduced opacity
   - [ ] Event cards show all required information
   - [ ] Smooth animations on page load

## Future Improvements

1. **Use Deterministic UUIDs in Initial Migration**
   - Update `20260109032347_create_lcl_social_app_schema.sql` to use fixed UUIDs instead of `gen_random_uuid()`
   - This would prevent the mismatch from occurring in the first place

2. **Environment-Specific Test Data**
   - Consider using environment-specific profile IDs
   - Allow configuring test profile ID via environment variable

3. **Better Dev Mode Detection**
   - Add more robust detection for when to use test profile
   - Consider adding a dev mode toggle in the UI

4. **Database Seed Script**
   - Create a comprehensive seed script that ensures all test data is consistent
   - Include script to reset and re-seed database for testing

## Related Files

- `src/pages/MyEvents.tsx` - My Events page component
- `src/lib/hooks.ts` - Data fetching hooks including `useAllUserCommitments`
- `src/components/EventTimeline.tsx` - Timeline display component
- `src/components/TimelineEventCard.tsx` - Individual event card component
- `supabase/migrations/20260109032347_create_lcl_social_app_schema.sql` - Initial schema
- `supabase/migrations/20260113233828_8a0e06c3-b8bf-4b4e-9e9d-4e4fa02cd151.sql` - Event attendees
- `supabase/migrations/20260114000000_fix_test_profile_uuid.sql` - **The fix**

## Debugging Tips

If events still don't show up:

1. **Check Browser Console**
   ```javascript
   // Add temporary logging to useAllUserCommitments
   console.log('Profile ID:', profileId);
   console.log('Query result:', { data, error });
   console.log('Processed events:', commitmentsWithEvents);
   ```

2. **Check Supabase Database**
   ```sql
   -- Verify profile exists
   SELECT * FROM profiles WHERE id = 'de595401-5c4f-40fc-8d3a-a627e49780ff';
   
   -- Verify events exist
   SELECT id, title, event_date FROM events 
   WHERE id IN (
     'adb96d9e-60f5-49f0-a855-61ace082fc45',
     '2a9aefb0-82a5-42b1-b715-819f48b5d362',
     '5dd99a4a-9e15-4ac6-aa8b-89bed8fb7ec3',
     'bbd9adcf-158e-49ae-b237-43a396ebeee8',
     '71b39cff-d9a8-4f22-885d-5c2244f6f9c5'
   );
   
   -- Verify event_attendees links
   SELECT * FROM event_attendees 
   WHERE profile_id = 'de595401-5c4f-40fc-8d3a-a627e49780ff';
   ```

3. **Check RLS Policies**
   ```sql
   -- Verify anyone can read events
   SELECT * FROM events LIMIT 1;
   
   -- Verify anyone can read profiles
   SELECT * FROM profiles LIMIT 1;
   
   -- Verify anyone can read event_attendees
   SELECT * FROM event_attendees LIMIT 1;
   ```

4. **Check Network Tab**
   - Look for Supabase API calls to `event_attendees`
   - Verify the response contains events
   - Check for any CORS or authentication errors

## Summary

The fix ensures that:
- ✅ Test profile exists with the expected UUID
- ✅ Test events exist with expected UUIDs
- ✅ Event attendees properly link profile to events
- ✅ Events use relative dates so they're always upcoming
- ✅ Timeline logic correctly groups and displays events
- ✅ Filtering separates upcoming and past events
- ✅ UI shows proper empty states when no events exist
