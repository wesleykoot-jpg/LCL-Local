/**
 * Feed Algorithm Module
 * 
 * This module implements a smart ranking algorithm for the event feed.
 * The algorithm considers multiple factors to personalize event recommendations:
 * 
 * 1. Category Preference Match (40% weight)
 *    - Events matching user's selected categories get higher scores
 * 
 * 2. Time Relevance (25% weight)
 *    - Events happening soon get higher priority
 *    - Uses exponential decay for events far in the future
 * 
 * 3. Social Proof (20% weight)
 *    - Events with more attendees are ranked higher
 *    - Applies logarithmic scaling to prevent large events from dominating
 * 
 * 4. Event Match Score (15% weight)
 *    - Uses the pre-computed match_percentage from the database
 *    - Represents algorithmic compatibility
 * 
 * Additionally, the algorithm ensures feed diversity by:
 * - Preventing too many cards of the same category appearing consecutively
 * - Boosting underrepresented categories in the initial results
 */

export interface EventForRanking {
  id: string;
  category: string;
  event_date: string;
  match_percentage?: number | null;
  attendee_count?: number;
  image_url?: string | null;
  // Add any other fields needed for display
  [key: string]: any;
}

export interface UserPreferences {
  selectedCategories: string[];
  zone: string;
}

interface ScoredEvent<T extends EventForRanking> {
  event: T;
  score: number;
  breakdown: {
    categoryScore: number;
    timeScore: number;
    socialScore: number;
    matchScore: number;
  };
}

// Algorithm weights - sum should equal 1.0
const WEIGHTS = {
  CATEGORY: 0.40,
  TIME: 0.25,
  SOCIAL: 0.20,
  MATCH: 0.15,
} as const;

// Configuration constants
const CONFIG = {
  // Time decay: how quickly score decreases for future events (in days)
  TIME_DECAY_DAYS: 7,
  // Social proof: logarithmic base for attendee count scaling
  SOCIAL_LOG_BASE: 10,
  // Diversity: minimum distance between same-category events
  DIVERSITY_MIN_GAP: 2,
} as const;

/**
 * Calculates category preference score (0-1)
 * Returns 1.0 if event category matches user preferences, otherwise returns a penalty score
 */
function calculateCategoryScore(
  eventCategory: string,
  userCategories: string[]
): number {
  if (userCategories.length === 0) {
    // No preferences set - all categories equal
    return 0.5;
  }
  
  // Direct match
  if (userCategories.includes(eventCategory)) {
    return 1.0;
  }
  
  // Not in preferences - apply penalty but don't eliminate completely
  return 0.3;
}

/**
 * Calculates time relevance score (0-1)
 * Events happening sooner get higher scores with exponential decay
 */
function calculateTimeScore(eventDate: string): number {
  const now = new Date();
  const eventDateTime = new Date(eventDate);
  const daysUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  // Events in the past get zero score
  if (daysUntilEvent < 0) {
    return 0;
  }
  
  // Events happening very soon (within 24 hours) get maximum score
  if (daysUntilEvent < 1) {
    return 1.0;
  }
  
  // Exponential decay for future events
  // Score decreases by ~50% every TIME_DECAY_DAYS
  const decayFactor = Math.exp(-daysUntilEvent / CONFIG.TIME_DECAY_DAYS);
  return Math.max(0.1, decayFactor); // Minimum score of 0.1 for variety
}

/**
 * Calculates social proof score (0-1)
 * Uses logarithmic scaling to prevent huge events from dominating
 */
function calculateSocialScore(attendeeCount: number = 0): number {
  if (attendeeCount <= 0) {
    return 0.2; // Base score for events with no attendees
  }
  
  // Logarithmic scaling: log10(attendees) / log10(1000)
  // This means: 1 attendee ≈ 0.2, 10 ≈ 0.5, 100 ≈ 0.8, 1000 ≈ 1.0
  const maxAttendees = 1000;
  const score = Math.log10(attendeeCount + 1) / Math.log10(maxAttendees);
  
  return Math.min(1.0, Math.max(0.2, score));
}

/**
 * Normalizes the match percentage score (0-1)
 */
function calculateMatchScore(matchPercentage: number | null | undefined): number {
  if (matchPercentage == null) {
    return 0.5; // Default score if not available
  }
  
  return matchPercentage / 100;
}

/**
 * Calculates a composite score for an event based on multiple factors
 */
function scoreEvent<T extends EventForRanking>(
  event: T,
  preferences: UserPreferences | null
): ScoredEvent<T> {
  const userCategories = preferences?.selectedCategories || [];
  
  const categoryScore = calculateCategoryScore(event.category, userCategories);
  const timeScore = calculateTimeScore(event.event_date);
  const socialScore = calculateSocialScore(event.attendee_count);
  const matchScore = calculateMatchScore(event.match_percentage);
  
  // Weighted sum of all factors
  const totalScore = 
    categoryScore * WEIGHTS.CATEGORY +
    timeScore * WEIGHTS.TIME +
    socialScore * WEIGHTS.SOCIAL +
    matchScore * WEIGHTS.MATCH;
  
  return {
    event,
    score: totalScore,
    breakdown: {
      categoryScore,
      timeScore,
      socialScore,
      matchScore,
    },
  };
}

/**
 * Applies diversity logic to prevent category clustering
 * Reorders events to ensure variety in the feed
 */
function ensureDiversity<T extends EventForRanking>(
  scoredEvents: ScoredEvent<T>[]
): ScoredEvent<T>[] {
  if (scoredEvents.length <= CONFIG.DIVERSITY_MIN_GAP) {
    return scoredEvents;
  }
  
  const result: ScoredEvent<T>[] = [];
  const remaining = [...scoredEvents];
  
  // Track the last N categories added
  const recentCategories: string[] = [];
  
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestAdjustedScore = -1;
    
    // Find the best event considering both score and diversity
    for (let i = 0; i < remaining.length; i++) {
      const event = remaining[i];
      let adjustedScore = event.score;
      
      // Penalize if this category was recently shown
      const categoryIndex = recentCategories.indexOf(event.event.category);
      if (categoryIndex !== -1) {
        const recency = recentCategories.length - categoryIndex;
        const penalty = 1 - (recency / (CONFIG.DIVERSITY_MIN_GAP + 1));
        adjustedScore *= penalty;
      }
      
      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = i;
      }
    }
    
    // Add the best event to results
    const selectedEvent = remaining.splice(bestIndex, 1)[0];
    result.push(selectedEvent);
    
    // Track category
    recentCategories.push(selectedEvent.event.category);
    if (recentCategories.length > CONFIG.DIVERSITY_MIN_GAP) {
      recentCategories.shift();
    }
  }
  
  return result;
}

/**
 * Main function: Ranks events based on the feed algorithm
 * 
 * @param events - Array of events to rank
 * @param preferences - User preferences from onboarding
 * @param options - Optional configuration
 * @returns Ranked array of events
 */
export function rankEvents<T extends EventForRanking>(
  events: T[],
  preferences: UserPreferences | null,
  options?: {
    ensureDiversity?: boolean;
    debug?: boolean;
  }
): T[] {
  const { ensureDiversity: applyDiversity = true, debug = false } = options || {};
  
  // Score all events
  let scoredEvents = events.map(event => scoreEvent(event, preferences));
  
  // Apply diversity if enabled
  if (applyDiversity) {
    scoredEvents = ensureDiversity(scoredEvents);
  } else {
    // Just sort by score
    scoredEvents.sort((a, b) => b.score - a.score);
  }
  
  // Debug logging
  if (debug && import.meta.env.DEV) {
    console.group('🎯 Feed Algorithm Results');
    console.log('User Preferences:', preferences);
    console.table(
      scoredEvents.slice(0, 10).map(({ event, score, breakdown }) => ({
        title: event.title || event.id.slice(0, 8),
        category: event.category,
        score: score.toFixed(3),
        ...Object.fromEntries(
          Object.entries(breakdown).map(([k, v]) => [k, v.toFixed(2)])
        ),
      }))
    );
    console.groupEnd();
  }
  
  // Return just the events in ranked order
  return scoredEvents.map(scored => scored.event);
}

/**
 * Export for testing and documentation
 */
export const algorithmConfig = {
  weights: WEIGHTS,
  config: CONFIG,
} as const;
