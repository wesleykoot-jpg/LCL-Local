# Hybrid Life Persona System

## Overview

The Hybrid Life Persona System is an intelligent feed personalization feature that automatically detects user interests and allows them to toggle between "Family Mode" and "Social Mode" for optimized event recommendations.

## Architecture

### 1. Database Schema

#### Profiles Table Extensions
- **`is_parent_detected`** (boolean, default: false): Automatically set when user shows parenting signals
- **`interest_scores`** (JSONB): Tracks interaction counts per category ID

Example interest_scores structure:
```json
{
  "family": 8,
  "active": 5,
  "social": 3,
  "music": 2
}
```

### 2. Feed Modes

#### Family Mode
- **Multipliers:**
  - Family category: 2.5x boost
  - Outdoors/Active categories: 1.5x boost (when `is_parent_detected` is true)
- **Use case:** Parents looking for kid-friendly activities

#### Social Mode
- **Multipliers:**
  - Social/Music/Foodie categories: 2.0x boost
  - Family category: 0.3x suppression
- **Use case:** Adults looking for nightlife and social activities

#### Default Mode
- No special multipliers applied
- Shows balanced feed based on preferences

### 3. Implicit Detection

#### Interest Score Tracking
The system tracks user interactions:
- **View event:** +1 to category score
- **Like event:** +2 to category score
- **Join event:** +3 to category score

When the `family` category score exceeds 5, the user is automatically marked as `is_parent_detected: true`.

#### Calendar Insights
The Edge Function `process-calendar-insights` scans Google Calendar events for parenting keywords:
- School, Zwemles, Voetbal, Kinderopvang, Birthday Party, Opvang
- Daycare, Playdate, Kids, Children, Soccer, Swimming, etc.

When more than 3 matching events are found, `is_parent_detected` is set to true.

## API Reference

### Interest Tracking API

Located in: `src/features/events/api/interestTracking.ts`

#### `trackEventView(profileId: string, eventCategory: string)`
Increments interest score by 1 when user views an event.

#### `trackEventLike(profileId: string, eventCategory: string)`
Increments interest score by 2 when user likes/saves an event.

#### `trackEventJoin(profileId: string, eventCategory: string)`
Increments interest score by 3 when user joins an event.

### Feed Context

Located in: `src/contexts/FeedContext.tsx`

Provides:
- `feedMode`: Current feed mode ('family' | 'social' | 'default')
- `setFeedMode(mode)`: Change feed mode
- `isParentDetected`: Whether user has been detected as a parent
- `setIsParentDetected(detected)`: Update parent detection status

State persists in localStorage.

## UI Components

### FloatingNav Component
- Shows current mode badge at top of nav bar
- Mode toggle button (4th button on feed page)
- Modal for selecting between Family/Social/Default modes

### EventStackCard Component
- Displays context badge when in active mode:
  - "Parent Favorite" (teal) in Family Mode for family events
  - "Family Fun" (teal) in Family Mode for outdoors/active events
  - "Solo Friendly" (blue) in Social Mode for social/music/foodie events

### OnboardingWizard Component
- Step 3 now includes "Smart Feed Learning" explainer
- Removed explicit persona questions
- Explains that the feed learns from user interests

## Database Migrations

### Migration 1: Add Persona Fields
File: `supabase/migrations/20260114120000_add_hybrid_life_persona_fields.sql`

Adds:
- `is_parent_detected` column
- `interest_scores` JSONB column
- Indexes for performance

### Migration 2: Update Feed RPC
File: `supabase/migrations/20260114121000_update_personalized_feed_with_modes.sql`

Updates `get_personalized_feed` function to:
- Accept `feed_mode` parameter
- Apply mode-based category multipliers
- Consider `is_parent_detected` for additional boosts

## Edge Functions

### process-calendar-insights
File: `supabase/functions/process-calendar-insights/index.ts`

**Endpoint:** POST `/functions/v1/process-calendar-insights`

**Request Body:**
```json
{
  "profileId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "matchCount": 5,
  "isParentDetected": true,
  "eventsScanned": 47
}
```

**Usage:**
Call this function after a user connects their Google Calendar to scan for parenting signals.

## Integration Guide

### 1. Wrap your app with FeedProvider

```tsx
import { FeedProvider } from '@/contexts/FeedContext';

function App() {
  return (
    <FeedProvider>
      {/* Your app content */}
    </FeedProvider>
  );
}
```

### 2. Use the feed mode in components

```tsx
import { useFeedMode } from '@/contexts/FeedContext';

function MyComponent() {
  const { feedMode, setFeedMode, isParentDetected } = useFeedMode();
  
  // Use feedMode to customize UI or API calls
}
```

### 3. Track user interactions

```tsx
import { trackEventView, trackEventJoin } from '@/features/events/api/interestTracking';

// When user views an event
await trackEventView(profileId, eventCategory);

// When user joins an event
const result = await trackEventJoin(profileId, eventCategory);
if (result.isParentDetected) {
  // User is now detected as a parent
  setIsParentDetected(true);
}
```

### 4. Pass feed mode to feed algorithm

```tsx
import { rankEvents } from '@/features/events/api/feedAlgorithm';
import { useFeedMode } from '@/contexts/FeedContext';

const { feedMode, isParentDetected } = useFeedMode();

const rankedEvents = rankEvents(events, {
  ...userPreferences,
  feedMode,
  isParentDetected,
});
```

## Testing

Tests are located in: `src/features/events/api/__tests__/feedAlgorithm.test.ts`

Run tests:
```bash
npm test
```

The test suite validates:
- Mode-based multipliers work correctly
- Family mode boosts family/outdoors/active events
- Social mode boosts social/music/foodie events and suppresses family
- Default mode uses standard weights
- Existing urgency and trending boosts still work

## Future Enhancements

Potential improvements:
1. Add more sophisticated ML-based persona detection
2. Implement A/B testing for multiplier values
3. Add user feedback mechanism to improve detection
4. Create admin dashboard for monitoring detection accuracy
5. Add more granular category preferences within modes
