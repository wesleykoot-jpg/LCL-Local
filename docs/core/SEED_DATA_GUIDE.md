# Seed Data Guide

## Overview

The LCL Local development environment includes persistent mock seed data to facilitate testing. This guide explains how to use and manage the test data.

## Mock Events

The seed data includes **4 persistent mock events** that automatically maintain future dates:

1. **Cinema Night** - 2 days from today at 19:00
2. **Sports Match** - 4 days from today at 15:00  
3. **Gaming Session** - 1 day from today at 20:00
4. **Food Market** - 6 days from today at 11:00

These events also include 2 "fork" events (sidecars):
- Pre-Movie Drinks (before Cinema Night)
- Post-Match Celebration (after Sports Match)

## Test Profile

A test profile is automatically created with ID `11111111-1111-1111-1111-111111111111`:
- **Name**: Dev Tester
- **Location**: Amsterdam, NL
- **Persona**: Family
- **Reliability Score**: 95

## Refreshing Event Dates

Mock events use dynamic dates that are calculated relative to `CURRENT_DATE`. However, if you need to manually refresh the dates (e.g., after testing or if dates become stale):

### Using SQL

```sql
SELECT dev_refresh_mock_event_dates();
```

This function updates all 4 mock events (and their forks) to maintain their relative future dates.

### Using Supabase CLI

```bash
# Connect to local database
supabase db reset

# Or execute the function directly
echo "SELECT dev_refresh_mock_event_dates();" | supabase db reset
```

## Other Helper Functions

### Reset All Data

To clear all data and start fresh:

```sql
SELECT dev_reset_data();
```

⚠️ **Warning**: This deletes ALL data from the database, including:
- All events
- All profiles
- All attendance records
- All persona stats and badges

After resetting, you'll need to re-run the seed script or use `supabase db reset`.

### Create Test Profile

To quickly create a new test profile:

```sql
SELECT dev_create_test_profile('Your Name');
-- Returns: UUID of the new profile
```

### Create Test Event

To quickly create a test event:

```sql
SELECT dev_create_test_event(
  'Event Title',
  'cinema',  -- category: cinema, sports, gaming, food, etc.
  'profile-uuid-here'  -- optional, uses first profile if not provided
);
-- Returns: UUID of the new event
```

## Testing Join Button Flow

The mock events are NOT pre-joined by the test profile. This allows you to test the complete join flow:

1. Navigate to `/feed`
2. Find one of the mock events (Cinema Night, Sports Match, etc.)
3. Click the "Join Event" button
4. Navigate to `/planning`
5. Verify the event appears in your planning timeline

## Automatic Date Refresh

The mock events are designed to stay in the future automatically because they use `CURRENT_DATE` in the seed script. However, if you're running a long-lived development database, you may want to periodically run the refresh function to ensure dates stay current.

### Scheduling Auto-Refresh (Optional)

If you want dates to refresh automatically every day, you can set up a cron job (requires Supabase Edge Functions or external scheduler):

```sql
-- This would need to be called daily at midnight
SELECT dev_refresh_mock_event_dates();
```

For local development, manual refresh is usually sufficient.

## Troubleshooting

### Events showing in "Past" section

If mock events are appearing in the past section:

1. Check the current date in your database: `SELECT CURRENT_DATE;`
2. Run the refresh function: `SELECT dev_refresh_mock_event_dates();`
3. Refresh your browser to reload the feed

### Join button not working

If clicking "Join Event" doesn't add the event to planning:

1. Check browser console for errors
2. Verify you're using the test profile (ID: `11111111-1111-1111-1111-111111111111`)
3. Verify the event hasn't already been joined (check `event_attendees` table)
4. Try refreshing the planning page manually

### No events in feed

If the feed is empty:

1. Verify seed data exists: `SELECT COUNT(*) FROM events;`
2. If count is 0, re-run seed script: `supabase db reset`
3. Verify events have future dates: `SELECT id, title, event_date FROM events;`

## Database Schema

The mock events use these key tables:

- `events` - Event details, dates, locations
- `event_attendees` - Join records linking profiles to events
- `profiles` - User profile data
- `persona_stats` - Gamification stats
- `persona_badges` - Achievement badges

All tables have Row Level Security (RLS) enabled. The test profile has appropriate permissions to join and view events.
