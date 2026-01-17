# Feed Algorithm Documentation

> **Source Code**: [`src/lib/feedAlgorithm.ts`](src/lib/feedAlgorithm.ts)

## Overview

The LCL Local app uses a sophisticated ranking algorithm to personalize the event feed for each user. The algorithm considers multiple factors with configurable weights, applies urgency and trending boosts, and ensures feed diversity to prevent category clustering.

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Feed Algorithm Flow                         │
└─────────────────────────────────────────────────────────────────┘

INPUT: Raw Events + User Preferences
   │
   ├─► Event 1 (Social, Tomorrow, 50 attendees, 88% match)
   ├─► Event 2 (Gaming, Tonight, 5 attendees, 75% match)
   ├─► Event 3 (Music, 2 months, 500 attendees, 92% match)
   └─► Event N...
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Multi-Factor Scoring                                   │
│                                                                  │
│  For each event, calculate:                                     │
│    ┌─────────────────────────────────────────────────────┐    │
│    │ Category Score (35%)                                │    │
│    │   ├─ Matches preferences? → 1.0                     │    │
│    │   └─ Not in preferences? → 0.3                      │    │
│    ├─────────────────────────────────────────────────────┤    │
│    │ Time Score (20%)                                    │    │
│    │   ├─ <24 hours away → 1.0                           │    │
│    │   └─ Further away → exponential decay               │    │
│    ├─────────────────────────────────────────────────────┤    │
│    │ Social Score (15%)                                  │    │
│    │   └─ log₁₀(attendees) / log₁₀(1000)                │    │
│    ├─────────────────────────────────────────────────────┤    │
│    │ Match Score (10%)                                   │    │
│    │   └─ match_percentage / 100                         │    │
│    ├─────────────────────────────────────────────────────┤    │
│    │ Distance Score (20%)                                │    │
│    │   └─ 1 / (1 + distance_km / radius)                 │    │
│    └─────────────────────────────────────────────────────┘    │
│                                                                  │
│  Base Score = (Category×0.35 + Time×0.20 + Social×0.15         │
│                + Match×0.10 + Distance×0.20)                    │
│                                                                  │
│  Urgency Boost = 1.0-1.2x (events within 6-72 hours)           │
│  Trending Boost = 1.0-1.2x (events with 10+ attendees)         │
│  Total Score = Base Score × min(Urgency × Trending, 1.5)       │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
SCORED EVENTS (sorted by score)
   │
   ├─► Event 1: Score 0.87
   ├─► Event 2: Score 0.54
   ├─► Event 3: Score 0.45
   └─► Event N...
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Diversity Filter                                       │
│                                                                  │
│  Reorder to prevent category clustering:                        │
│    1. Track last 2 categories shown                             │
│    2. Penalize repeated categories                              │
│    3. Boost underrepresented categories                         │
│                                                                  │
│  Example:                                                        │
│    ✓ Social  (0.87) → Selected                                  │
│    ✓ Gaming  (0.54) → Selected (different category)             │
│    ✗ Social  (0.85) → Skipped (too soon after Social)           │
│    ✓ Music   (0.45) → Selected (provides variety)               │
│    ✓ Social  (0.85) → Now selectable                            │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
OUTPUT: Ranked Feed (personalized & diverse)
   │
   ├─► Social Event (high score, great timing)
   ├─► Gaming Event (good timing, variety)
   ├─► Music Event (variety boost)
   └─► More events...
```

## Algorithm Components

### 1. Multi-Factor Scoring System

The algorithm evaluates each event based on five key factors with the following weights:

```typescript
// Source: src/lib/feedAlgorithm.ts
const WEIGHTS = {
  CATEGORY: 0.35,  // 35% - User preference match
  TIME: 0.20,      // 20% - Time relevance
  SOCIAL: 0.15,    // 15% - Social proof
  MATCH: 0.10,     // 10% - Pre-computed match
  DISTANCE: 0.20,  // 20% - Proximity to user
} as const;
```

#### Category Preference Match (35% weight)
- **Purpose**: Prioritize events in categories the user selected during onboarding
- **How it works**:
  - Events matching user preferences: **1.0 score**
  - Events not in preferences: **0.3 score** (penalty but not eliminated)
  - No preferences set: **0.5 score** (all categories equal)
- **Rationale**: User preferences are the strongest signal for relevance, but we don't want to create filter bubbles

#### Time Relevance (20% weight)
- **Purpose**: Prioritize events happening soon while still showing future events
- **How it works**:
  - Events within 24 hours: **1.0 score**
  - Future events: Exponential decay over time
  - Past events: **0.0 score**
  - Decay rate: ~50% reduction every 7 days (configurable via `TIME_DECAY_DAYS`)
- **Rationale**: Users are more likely to attend events happening soon, but we want to give them planning time

#### Social Proof (15% weight)
- **Purpose**: Surface popular events with high attendance
- **How it works**:
  - Logarithmic scaling: log₁₀(attendees + 1) / log₁₀(1000)
  - 0 attendees: **0.2 score** (base score)
  - 10 attendees: **~0.5 score**
  - 100 attendees: **~0.8 score**
  - 1000+ attendees: **1.0 score**
- **Rationale**: Logarithmic scaling prevents huge events from dominating while still rewarding popularity

#### Match Percentage (10% weight)
- **Purpose**: Use pre-computed algorithmic compatibility scores
- **How it works**:
  - Direct normalization: match_percentage / 100
  - Default: **0.5 score** if not available
- **Rationale**: Database-computed matches can incorporate factors like location, past behavior, etc.

#### Distance/Proximity (20% weight)
- **Purpose**: Prioritize events closer to the user's current location
- **How it works**:
  - Uses Haversine formula to calculate distance between user and event
  - Inverse distance scoring: `1 / (1 + distance_km / (radius * 0.5))`
  - At 0 km: **1.0 score**
  - At radius (default 25km): **~0.5 score**
  - Beyond radius: decreases towards **0.1 minimum**
- **Rationale**: Users are more likely to attend nearby events, but we don't want to eliminate distant events completely

### 2. Boost Multipliers

After calculating the base score, the algorithm applies two types of boosts to surface time-sensitive and popular events:

#### Urgency Boost (1.0-1.2x multiplier)
Boosts events happening soon to surface "tonight" and "this weekend" opportunities:

```typescript
// Source: src/lib/feedAlgorithm.ts
function calculateUrgencyBoost(eventDate: string): number {
  const hoursUntilEvent = (eventTime - now) / (1000 * 60 * 60);
  
  if (hoursUntilEvent <= 6)  return 1.2;   // Tonight (within 6 hours)
  if (hoursUntilEvent <= 24) return 1.15;  // Today (within 24 hours)
  if (hoursUntilEvent <= 72) return 1.1;   // This weekend (within 72 hours)
  return 1.0;                               // No boost for future events
}
```

#### Trending Boost (1.0-1.2x multiplier)
Boosts events with strong social proof to highlight popular happenings:

```typescript
// Source: src/lib/feedAlgorithm.ts
function calculateTrendingBoost(attendeeCount: number): number {
  if (attendeeCount >= 100) return 1.2;   // Very popular
  if (attendeeCount >= 50)  return 1.15;  // Popular
  if (attendeeCount >= 20)  return 1.1;   // Moderately popular
  if (attendeeCount >= 10)  return 1.05;  // Some traction
  return 1.0;                              // No boost
}
```

#### Combined Boost (capped at 1.5x)
The final score combines both boosts with a maximum cap:

```typescript
const boostMultiplier = Math.min(urgencyBoost * trendingBoost, 1.5);
const totalScore = baseScore * boostMultiplier;
```

This prevents events from being over-boosted (e.g., a very urgent AND very popular event gets 1.5x max, not 1.44x).

### 3. Diversity Mechanism

After scoring, the algorithm applies a diversity filter to prevent category clustering:

- **Minimum Gap**: Events of the same category are separated by at least 2 positions
- **How it works**:
  1. Track the last N categories shown (where N = diversity gap)
  2. Apply a penalty to events in recently-shown categories
  3. Penalty strength decreases with distance
  4. Select events that maximize (score × diversity_bonus)

- **Example**: If "Social" events appear in positions 1 and 2, a third "Social" event will be pushed down even if it has a high score, allowing "Gaming" or "Music" events to appear first.

### 4. Configuration

All algorithm parameters are configurable via constants in [`src/lib/feedAlgorithm.ts`](src/lib/feedAlgorithm.ts):

```typescript
const WEIGHTS = {
  CATEGORY: 0.35,  // User preference match
  TIME: 0.20,      // Time relevance
  SOCIAL: 0.15,    // Social proof
  MATCH: 0.10,     // Pre-computed match
  DISTANCE: 0.20,  // Proximity to user
} as const;

const CONFIG = {
  TIME_DECAY_DAYS: 7,          // Half-life for time decay (days)
  SOCIAL_LOG_BASE: 10,         // Base for logarithmic attendee scaling
  DIVERSITY_MIN_GAP: 2,        // Minimum positions between same category
  DEFAULT_RADIUS_KM: 25,       // Default search radius for distance scoring
  DISTANCE_MIN_SCORE: 0.1,     // Minimum distance score for far events
} as const;
```

## Usage

### In Components

```typescript
import { rankEvents, type UserPreferences } from '@/lib/feedAlgorithm';

// Get user preferences
const { preferences } = useOnboarding();

// Fetch events
const { events } = useEvents();

// Apply ranking
const rankedEvents = rankEvents(events, preferences, {
  ensureDiversity: true,
  debug: true, // Enable debug logging
});
```

### Debug Mode

Enable debug logging in development to see scoring breakdowns:

```typescript
const rankedEvents = rankEvents(events, preferences, {
  debug: import.meta.env.DEV
});
```

This will output a table showing:
- Event title and category
- Total score
- Individual component scores (category, time, social, match)

## Algorithm Benefits

1. **Personalization**: Events matching user interests appear first (35% weight)
2. **Timeliness**: Upcoming events are prioritized with urgency boosts
3. **Discovery**: Non-preferred categories still appear (with penalty)
4. **Social Validation**: Popular events are highlighted with trending boosts
5. **Proximity**: Nearby events rank higher (20% weight)
6. **Diversity**: Feed doesn't become monotonous
7. **Flexibility**: Weights and boosts can be tuned based on user feedback

## Future Enhancements

Potential improvements to consider:

1. **Friend-based boosting**: Events with friends attending get higher scores
2. **Location-based ranking**: Events closer to user get priority
3. **Collaborative filtering**: "Users like you also enjoyed..."
4. **Time-of-day preferences**: Morning person vs night owl
5. **Engagement tracking**: Learn from user interactions (clicks, joins, saves)
6. **A/B testing framework**: Experiment with different weight configurations
7. **Fatigue prevention**: Reduce scores for frequently-shown event types
8. **Recency bias**: Slightly boost newly-created events

## Performance Considerations

- **Complexity**: O(n log n) due to sorting (n = number of events)
- **Memoization**: Results are cached using React's `useMemo`
- **Incremental updates**: Only re-rank when events or preferences change
- **Client-side**: All ranking happens in the browser (no API calls)

## Testing & Verification

### Quick Test in Browser Console

1. Open the app in development mode (`npm run dev`)
2. Navigate to the Feed page
3. Open browser console (F12)
4. Look for "🎯 Feed Algorithm Results" debug output
5. The table shows each event's score breakdown

### Test with Different Preferences

1. Click the Settings icon in the Feed header
2. Select different category preferences in onboarding
3. Observe how the feed reorders based on your selections
4. Expected behaviors:
   - Events in selected categories move to top
   - Events happening soon are prioritized
   - Popular events (high attendance) rank higher
   - Categories are mixed (not clustered)

### Verification Checklist

- [ ] **Category Preference Works**: Select "Social" + "Music" categories, verify those events appear first
- [ ] **Time Relevance Works**: Events happening tomorrow rank higher than events next month
- [ ] **Social Proof Works**: Events with 100 attendees rank higher than events with 5 attendees (all else equal)
- [ ] **Diversity Works**: No more than 2-3 consecutive events of the same category
- [ ] **Discovery Works**: Categories NOT in preferences still appear (with penalty)
- [ ] **No Preferences Works**: Without preferences, events ranked by time + social + match

### Running the Demo Script

```bash
node scripts/test-feed-algorithm.js
```

This shows scoring examples and explains how different user types see different rankings.

### Manual Testing Scenarios

**Scenario 1: The Socialite**
- Set preferences: Social, Entertainment, Music
- Expected: Bars, concerts, parties appear first
- Why: 40% weight on category match makes these score highest

**Scenario 2: The Athlete** 
- Set preferences: Active, Outdoors
- Expected: Sports, hiking, fitness events appear first
- Why: Category match outweighs other factors

**Scenario 3: The Newcomer**
- Set preferences: None (skip onboarding or clear preferences)
- Expected: Mix of categories, prioritized by timing and popularity
- Why: Without preferences, all categories get 0.5 score, so time and social proof dominate

**Scenario 4: Diversity Check**
- Look at feed with many social events
- Expected: Social events are interspersed with other categories
- Why: Diversity mechanism prevents clustering

## Related Files

- [`src/lib/feedAlgorithm.ts`](src/lib/feedAlgorithm.ts) - Core algorithm implementation
- [`src/features/events/Feed.tsx`](src/features/events/Feed.tsx) - Feed component using the algorithm
- [`src/features/events/hooks/hooks.ts`](src/features/events/hooks/hooks.ts) - useEvents hook for fetching events
- [`src/lib/distance.ts`](src/lib/distance.ts) - Distance calculation utilities (Haversine formula)
