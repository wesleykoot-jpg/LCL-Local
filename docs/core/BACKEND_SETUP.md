# LCL Backend Setup Guide

## Overview

This document provides complete instructions for setting up the Supabase backend for the LCL (Hyper-Local Social App).

## Architecture

The backend implements three core features:

### 1. Sidecar Event Model
- **Official Events (Anchors)**: Large-scale events like festivals, movie screenings
- **User Sidecars (Forks)**: User-created meetups attached to official events (e.g., pre-movie drinks)
- **Live Zones (Signals)**: Ongoing activities and communities

### 2. Trust Passport Profile System
- **Reliability Score**: Tracks attendance rate (96% = attended 48 of last 50 events)
- **Dual Identity**: Users can switch between personas (Family Mode / Gamer Mode)
- **Per-Persona Stats**: Each identity has separate badges, ratings, and statistics

### 3. Geospatial Intelligence
- **PostGIS Integration**: Enables location-based event queries
- **Proximity Search**: Find events near user's current location
- **Map Visualization**: Display events with accurate coordinates

## Database Schema

### Tables

#### `profiles`
User profiles with reliability tracking
- `id`, `full_name`, `location_city`, `location_country`
- `location_coordinates` (PostGIS geography point)
- `reliability_score`, `events_attended`, `events_committed`
- `current_persona` (family/gamer)
- `verified_resident`

#### `persona_stats`
Per-persona statistics (one row per user per persona)
- `profile_id`, `persona_type`
- `rallies_hosted`, `newcomers_welcomed`, `host_rating`

#### `persona_badges`
Achievements earned in each persona
- `profile_id`, `persona_type`
- `badge_name`, `badge_level`, `badge_icon`

#### `events`
All events (anchors, forks, signals)
- `id`, `title`, `description`, `category`, `event_type`
- `parent_event_id` (for sidecars linked to anchors)
- `venue_name`, `location` (PostGIS geography point)
- `event_date`, `event_time`, `status`
- `image_url`, `match_percentage`, `created_by`

#### `event_attendees`
Many-to-many: users attending events
- `event_id`, `profile_id`, `status`
- `ticket_number`, `checked_in`

## Setup Instructions

### Step 1: Database Initialization

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Open the file `supabase/schema.sql` in this repository
4. Copy the entire contents
5. Paste into the Supabase SQL Editor
6. Click **Run** to execute

This single SQL file will:
- Enable PostGIS extension
- Create all tables with proper constraints
- Set up geospatial indexes
- Configure Row Level Security (RLS) policies
- Seed sample data matching the UI mockups

### Step 2: Verify Setup

After running the SQL script, verify the setup:

1. Go to **Table Editor** in Supabase dashboard
2. You should see 5 tables:
   - `profiles`
   - `persona_stats`
   - `persona_badges`
   - `events`
   - `event_attendees`

3. Check sample data:
   - 1 profile: "Alex van Berg"
   - 6 persona badges (3 family, 3 gamer)
   - 7 events (3 anchors, 2 forks, 2 signals)

### Step 3: Environment Variables

The `.env` file already contains your Supabase connection details:

```env
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are automatically loaded by the application.

### Step 4: Run the Application

```bash
npm run dev
```

The app will now fetch and display real data from Supabase!

## Key Features Implemented

### Sidecar Event Linking
```typescript
// Events with parent_event_id are "sidecars" attached to "anchor" events
const sidecarEvents = allEvents.filter(e => e.parent_event_id === anchorEventId);
```

### Dual Identity System
```typescript
// User can switch personas, each with different stats
const { stats } = usePersonaStats(profileId, 'family'); // or 'gamer'
const { badges } = usePersonaBadges(profileId, 'family');
```

### Geospatial Queries
```typescript
// Events store location as PostGIS geography points
// Format: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
const coords = parseGeography(event.location); // { lat: 52.7, lng: 6.2 }
```

### Reliability Score Calculation
```typescript
// Automatically calculated based on attendance
reliability_score = (events_attended / events_committed) * 100
// Example: 48 attended / 50 committed = 96%
```

## Custom Hooks

The app includes several React hooks for data fetching:

### `useProfile(profileId?)`
Fetches user profile (defaults to first profile if no ID provided)

### `usePersonaStats(profileId, personaType)`
Fetches stats for specific persona ('family' or 'gamer')

### `usePersonaBadges(profileId, personaType)`
Fetches badges earned in specific persona

### `useEvents(options?)`
Fetches all events with optional filtering:
- `category`: Filter by event category
- `eventType`: Filter by event type (anchor/fork/signal)

### `useEventWithSidecars(parentEventId)`
Fetches an anchor event and all its attached sidecar events

### `useUserCommitments(profileId)`
Fetches upcoming events the user has committed to attend

## Row Level Security (RLS)

For demo purposes, all tables use public access policies. For production:

1. Replace public policies with authenticated-only policies
2. Add user ownership checks
3. Example:
   ```sql
   CREATE POLICY "Users can update own profile"
     ON profiles FOR UPDATE
     TO authenticated
     USING (auth.uid() = id)
     WITH CHECK (auth.uid() = id);
   ```

## Geospatial Queries

PostGIS enables powerful location-based queries:

### Find events within radius
```sql
SELECT *
FROM events
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
  5000  -- 5km radius
);
```

### Calculate distance between points
```sql
SELECT
  title,
  ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography
  ) as distance_meters
FROM events
ORDER BY distance_meters;
```

## Troubleshooting

### No data showing in app
1. Check browser console for errors
2. Verify Supabase connection in `.env`
3. Confirm SQL script ran successfully
4. Check table data in Supabase dashboard

### PostGIS errors
Ensure the extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### RLS blocking queries
For development, you can temporarily disable RLS:
```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

## Next Steps

1. **Add Authentication**: Integrate Supabase Auth for real user accounts
2. **Implement Write Operations**: Add functions to create events, join events, etc.
3. **Add Real-time Subscriptions**: Use Supabase Realtime for live updates
4. **Enhance Geospatial Features**: Add proximity notifications, route planning
5. **Production RLS**: Implement proper authenticated access policies

## Support

For issues or questions about the backend implementation, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/documentation/)
- Project repository issues
