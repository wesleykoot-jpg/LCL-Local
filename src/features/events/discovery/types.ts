/**
 * Discovery Rail Provider Types
 * 
 * This module defines the type system for the strategy-based Discovery Rails.
 * Each rail is a standalone strategy responsible for:
 * - Its own metadata (title, description, icon)
 * - Filtering logic
 * - Priority/ordering
 * 
 * The 5 Psychological Pillars (in order):
 * 1. "For You" (The Ego) - Validation through personalization
 * 2. "Rituals" (The Habit) - Stability through recurring events
 * 3. "This Weekend" (The Reward) - Temporal anticipation
 * 4. "Happening in [Location]" (The Grounding) - Physical connection
 * 5. "Pulse of [Country]" (The Collective) - Big-picture belonging
 */

import type { EventWithAttendees } from "../hooks/hooks";

/**
 * Rail type identifiers matching the 5 psychological pillars
 */
export type RailType = 
  | "for-you"
  | "rituals"
  | "this-weekend"
  | "location"
  | "pulse";

/**
 * Animation style for each rail (emotional iconography)
 */
export type RailAnimationStyle = 
  | "pulse"      // Breathing effect for Location rail
  | "rhythm"     // Clock-like for Rituals
  | "sparkle"    // Excitement for This Weekend
  | "glow"       // Ego validation for For You
  | "wave";      // Collective pulse

/**
 * User context for rail filtering and title generation
 */
export interface RailContext {
  /** User's preferred categories from onboarding */
  selectedCategories: string[];
  /** User's current location city/region */
  locationCity?: string;
  /** User's country */
  country?: string;
  /** User's coordinates for distance calculations */
  userLocation?: { lat: number; lng: number } | null;
  /** Search radius in km */
  radiusKm?: number;
  /** Current user profile ID */
  profileId?: string;
  /** Bookmarked event IDs */
  bookmarkedEventIds?: Set<string>;
  /** User's past attended event IDs (for streak tracking) */
  attendedEventIds?: Set<string>;
}

/**
 * Metadata for a rail section
 */
export interface RailMetadata {
  /** Unique identifier for the rail type */
  type: RailType;
  /** Display title (may be dynamically generated) */
  title: string;
  /** Optional description text */
  description?: string;
  /** Animation style for visual differentiation */
  animationStyle: RailAnimationStyle;
  /** Optional icon component key */
  iconKey?: string;
  /** Priority for ordering (lower = higher priority) */
  priority: number;
  /** Whether this rail should show "See All" link */
  showSeeAll?: boolean;
}

/**
 * Result from a rail provider's filter function
 */
export interface RailResult {
  /** Metadata for the rail */
  metadata: RailMetadata;
  /** Filtered and sorted events for this rail */
  events: EventWithAttendees[];
  /** Whether to show this rail (false if empty or not applicable) */
  shouldShow: boolean;
}

/**
 * Weight configuration for feed algorithm contextual modes
 */
export interface ContextualWeights {
  category: number;
  time: number;
  social: number;
  match: number;
  distance: number;
  consistency?: number;  // For Rituals rail
  localVenue?: number;   // For Location rail
}

/**
 * Contextual mode for the feed algorithm
 */
export type ContextualMode = 
  | "default"
  | "for-you"
  | "rituals"
  | "temporal"
  | "local"
  | "collective";

/**
 * Configuration for detecting ritual events
 */
export interface RitualDetectionConfig {
  /** Minimum consecutive occurrences to be considered a ritual */
  minOccurrences: number;
  /** Time window for matching events (hours) */
  timeWindowHours: number;
  /** Keywords that indicate recurring events */
  ritualKeywords: string[];
}

/**
 * Ritual event metadata
 */
export interface RitualEventMeta {
  /** Whether this event is part of a ritual series */
  isRitual: boolean;
  /** Number of consecutive occurrences detected */
  occurrenceCount?: number;
  /** User's participation streak (if applicable) */
  userStreak?: number;
  /** Day of week this ritual occurs */
  ritualDay?: string;
}

/**
 * Rail Provider interface - each rail implements this
 */
export interface RailProvider {
  /** Unique type identifier */
  readonly type: RailType;
  
  /** Priority for ordering (lower = higher priority) */
  readonly priority: number;
  
  /** Get the metadata for this rail (may depend on context) */
  getMetadata(context: RailContext): RailMetadata;
  
  /** Filter and sort events for this rail */
  filterEvents(
    events: EventWithAttendees[], 
    context: RailContext
  ): EventWithAttendees[];
  
  /** Check if this rail should be displayed */
  shouldDisplay(events: EventWithAttendees[], context: RailContext): boolean;
  
  /** Get the contextual weights for this rail's algorithm */
  getWeights(): ContextualWeights;
}

/**
 * Default weights for each contextual mode
 */
export const CONTEXTUAL_WEIGHTS: Record<ContextualMode, ContextualWeights> = {
  default: {
    category: 0.35,
    time: 0.20,
    social: 0.15,
    match: 0.10,
    distance: 0.20,
  },
  "for-you": {
    category: 0.40,
    time: 0.15,
    social: 0.15,
    match: 0.15,
    distance: 0.15,
  },
  rituals: {
    category: 0.15,
    time: 0.10,
    social: 0.20,
    match: 0.05,
    distance: 0.10,
    consistency: 0.30,
    localVenue: 0.10,
  },
  temporal: {
    category: 0.25,
    time: 0.35,
    social: 0.15,
    match: 0.10,
    distance: 0.15,
  },
  local: {
    category: 0.20,
    time: 0.15,
    social: 0.15,
    match: 0.10,
    distance: 0.40,
  },
  collective: {
    category: 0.15,
    time: 0.15,
    social: 0.35,
    match: 0.10,
    distance: 0.05,
    localVenue: 0.20,
  },
};

/**
 * Default ritual detection configuration
 */
export const DEFAULT_RITUAL_CONFIG: RitualDetectionConfig = {
  minOccurrences: 3,
  timeWindowHours: 2,
  ritualKeywords: [
    // English
    "weekly", "monthly", "every", "recurring", "regular",
    "club", "meetup", "class", "group", "session",
    // Dutch
    "wekelijks", "maandelijks", "elke", "borrel", "ritueel",
    "training", "les", "groep", "sessie",
  ],
};
