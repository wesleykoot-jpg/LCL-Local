# Feed Algorithm Documentation

## Overview

The LCL Local app uses a sophisticated ranking algorithm to personalize the event feed for each user. The algorithm ensures that users see the most relevant events at the top of their feed while maintaining diversity and variety.

## Algorithm Components

### 1. Multi-Factor Scoring System

The algorithm evaluates each event based on four key factors:

#### Category Preference Match (40% weight)
- **Purpose**: Prioritize events in categories the user selected during onboarding
- **How it works**:
  - Events matching user preferences: **1.0 score**
  - Events not in preferences: **0.3 score** (penalty but not eliminated)
  - No preferences set: **0.5 score** (all categories equal)
- **Rationale**: User preferences are the strongest signal for relevance, but we don't want to create filter bubbles

#### Time Relevance (25% weight)
- **Purpose**: Prioritize events happening soon while still showing future events
- **How it works**:
  - Events within 24 hours: **1.0 score**
  - Future events: Exponential decay over time
  - Past events: **0.0 score**
  - Decay rate: ~50% reduction every 7 days
- **Rationale**: Users are more likely to attend events happening soon, but we want to give them planning time

#### Social Proof (20% weight)
- **Purpose**: Surface popular events with high attendance
- **How it works**:
  - Logarithmic scaling: log₁₀(attendees + 1) / log₁₀(1000)
  - 0 attendees: **0.2 score** (base score)
  - 10 attendees: **~0.5 score**
  - 100 attendees: **~0.8 score**
  - 1000+ attendees: **1.0 score**
- **Rationale**: Logarithmic scaling prevents huge events from dominating while still rewarding popularity

#### Match Percentage (15% weight)
- **Purpose**: Use pre-computed algorithmic compatibility scores
- **How it works**:
  - Direct normalization: match_percentage / 100
  - Default: **0.5 score** if not available
- **Rationale**: Database-computed matches can incorporate factors like location, past behavior, etc.

### 2. Diversity Mechanism

After scoring, the algorithm applies a diversity filter to prevent category clustering:

- **Minimum Gap**: Events of the same category are separated by at least 2 positions
- **How it works**:
  1. Track the last N categories shown (where N = diversity gap)
  2. Apply a penalty to events in recently-shown categories
  3. Penalty strength decreases with distance
  4. Select events that maximize (score × diversity_bonus)

- **Example**: If "Social" events appear in positions 1 and 2, a third "Social" event will be pushed down even if it has a high score, allowing "Gaming" or "Music" events to appear first.

### 3. Configuration

```typescript
const WEIGHTS = {
  CATEGORY: 0.40,  // User preference match
  TIME: 0.25,      // Time relevance
  SOCIAL: 0.20,    // Social proof
  MATCH: 0.15,     // Pre-computed match
} as const;

const CONFIG = {
  TIME_DECAY_DAYS: 7,      // Half-life for time decay
  SOCIAL_LOG_BASE: 10,     // Base for logarithmic scaling
  DIVERSITY_MIN_GAP: 2,    // Minimum positions between same category
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

1. **Personalization**: Events matching user interests appear first
2. **Timeliness**: Upcoming events are prioritized
3. **Discovery**: Non-preferred categories still appear (with penalty)
4. **Social Validation**: Popular events are highlighted
5. **Diversity**: Feed doesn't become monotonous
6. **Flexibility**: Weights can be tuned based on user feedback

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

## Testing

To verify the algorithm:

1. Set different category preferences in onboarding
2. Check console debug output to see score breakdowns
3. Verify that preferred categories appear near the top
4. Ensure diversity (no more than 2-3 consecutive same-category events)
5. Confirm upcoming events rank higher than distant ones

## Related Files

- `/src/lib/feedAlgorithm.ts` - Core algorithm implementation
- `/src/components/EventFeed.tsx` - Feed component using the algorithm
- `/src/pages/Feed.tsx` - Main feed page
- `/src/hooks/useOnboarding.ts` - User preferences management
