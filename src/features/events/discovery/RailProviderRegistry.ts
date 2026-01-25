/**
 * Rail Provider Registry
 *
 * Strategy-based system for Discovery Rails.
 * Each rail is a standalone strategy responsible for:
 * - Its own metadata (title, description)
 * - Filtering logic
 * - Priority ordering
 *
 * The registry allows easy extension with new rail strategies.
 */

import type { EventWithAttendees } from "../hooks/hooks";
import type {
  RailProvider,
  RailContext,
  RailMetadata,
  RailResult,
  RailType,
  ContextualWeights,
} from "./types";
import { CONTEXTUAL_WEIGHTS } from "./types";
import { formatRailTitle } from "./TitleFormatter";
import { filterRitualEvents } from "./ritualDetection";

/**
 * Base class for rail providers with common functionality
 */
abstract class BaseRailProvider implements RailProvider {
  abstract readonly type: RailType;
  abstract readonly priority: number;

  abstract filterEvents(
    events: EventWithAttendees[],
    context: RailContext,
  ): EventWithAttendees[];

  getMetadata(context: RailContext): RailMetadata {
    const { title, description } = formatRailTitle(this.type, context);
    return {
      type: this.type,
      title,
      description,
      animationStyle: this.getAnimationStyle(),
      priority: this.priority,
      showSeeAll: true,
    };
  }

  shouldDisplay(events: EventWithAttendees[], context: RailContext): boolean {
    return this.filterEvents(events, context).length > 0;
  }

  getWeights(): ContextualWeights {
    return (
      CONTEXTUAL_WEIGHTS[this.type as keyof typeof CONTEXTUAL_WEIGHTS] ||
      CONTEXTUAL_WEIGHTS["default"]
    );
  }

  protected abstract getAnimationStyle(): RailMetadata["animationStyle"];
}

/**
 * "For You" Rail - Validation through personalization
 * Priority: 1 (highest)
 */
class ForYouRailProvider extends BaseRailProvider {
  readonly type: RailType = "for-you";
  readonly priority = 1;

  protected getAnimationStyle(): RailMetadata["animationStyle"] {
    return "glow";
  }

  filterEvents(
    events: EventWithAttendees[],
    context: RailContext,
  ): EventWithAttendees[] {
    let filtered = events;

    // Filter by user's selected categories
    if (context.selectedCategories.length > 0) {
      filtered = events.filter((e) =>
        context.selectedCategories.includes(e.category),
      );
    }

    // Sort by match percentage and attendee count
    filtered = [...filtered].sort((a, b) => {
      const matchA = a.match_percentage || 0;
      const matchB = b.match_percentage || 0;
      if (matchB !== matchA) return matchB - matchA;
      return (b.attendee_count || 0) - (a.attendee_count || 0);
    });

    // Return top results
    return filtered.slice(0, 10);
  }

  getWeights(): ContextualWeights {
    return {
      category: 0.4,
      time: 0.15,
      social: 0.15,
      match: 0.15,
      distance: 0.15,
    };
  }
}

/**
 * "Rituals" Rail - Stability through recurring events
 * Priority: 2
 */
class RitualsRailProvider extends BaseRailProvider {
  readonly type: RailType = "rituals";
  readonly priority = 2;

  protected getAnimationStyle(): RailMetadata["animationStyle"] {
    return "rhythm";
  }

  filterEvents(
    events: EventWithAttendees[],
    _context: RailContext,
  ): EventWithAttendees[] {
    const ritualEvents = filterRitualEvents(events);

    // Filter for future events with dates
    const futureRituals = ritualEvents.filter(
      (e) => e.event_date && new Date(e.event_date) >= new Date()
    );

    // Fallback: if no future rituals, show events sorted by match percentage
    let resultEvents = futureRituals;
    if (resultEvents.length === 0) {
      // Show future events with valid match percentages as fallback
      resultEvents = [...events]
        .filter((e) => e.event_date && new Date(e.event_date) >= new Date())
        .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0))
        .slice(0, 10);
    }

    // Sort by upcoming date
    return [...resultEvents]
      .sort(
        (a, b) => {
          if (!a.event_date) return 1;
          if (!b.event_date) return -1;
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        }
      )
      .slice(0, 10);
  }

  getWeights(): ContextualWeights {
    return {
      category: 0.15,
      time: 0.1,
      social: 0.2,
      match: 0.05,
      distance: 0.1,
      consistency: 0.3,
      localVenue: 0.1,
    };
  }
}

/**
 * "This Weekend" Rail - Temporal anticipation and reward
 * Priority: 3
 */
class ThisWeekendRailProvider extends BaseRailProvider {
  readonly type: RailType = "this-weekend";
  readonly priority = 3;

  protected getAnimationStyle(): RailMetadata["animationStyle"] {
    return "sparkle";
  }

  filterEvents(
    events: EventWithAttendees[],
    _context: RailContext,
  ): EventWithAttendees[] {
    const now = new Date();
    const today = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Calculate start and end of "this weekend"
    const daysUntilSaturday = today <= 6 ? 6 - today : 0;
    const weekendStart = new Date(now);
    weekendStart.setDate(now.getDate() + daysUntilSaturday);
    weekendStart.setHours(0, 0, 0, 0);

    const weekendEnd = new Date(weekendStart);
    weekendEnd.setDate(weekendStart.getDate() + 2); // Through Sunday
    weekendEnd.setHours(23, 59, 59, 999);

    // If it's already weekend, include today
    if (today === 0 || today === 6) {
      weekendStart.setDate(now.getDate());
    }

    const weekendEvents = events.filter((e) => {
      if (!e.event_date) return false;
      const eventDate = new Date(e.event_date);
      return eventDate >= weekendStart && eventDate <= weekendEnd;
    });

    // Fallback: if no weekend events, show upcoming events within next 7 days
    let resultEvents = weekendEvents;
    if (resultEvents.length === 0) {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      resultEvents = events.filter((e) => {
        if (!e.event_date) return false;
        const eventDate = new Date(e.event_date);
        return eventDate >= now && eventDate <= nextWeek;
      });
    }

    // Sort by attendee count (popular events first) then by date
    return [...resultEvents]
      .sort((a, b) => {
        const countDiff = (b.attendee_count || 0) - (a.attendee_count || 0);
        if (countDiff !== 0) return countDiff;
        return (
          new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime()
        );
      })
      .slice(0, 10);
  }

  getWeights(): ContextualWeights {
    return {
      category: 0.25,
      time: 0.35,
      social: 0.15,
      match: 0.1,
      distance: 0.15,
    };
  }
}

/**
 * "Location" Rail - Physical connection to immediate community
 * Priority: 4
 */
class LocationRailProvider extends BaseRailProvider {
  readonly type: RailType = "location";
  readonly priority = 4;

  protected getAnimationStyle(): RailMetadata["animationStyle"] {
    return "pulse";
  }

  filterEvents(
    events: EventWithAttendees[],
    context: RailContext,
  ): EventWithAttendees[] {
    // Filter by proximity if distance_km is available
    const nearbyEvents = events.filter((e) => {
      if (typeof e.distance_km === "number") {
        const radiusKm = context.radiusKm || 25;
        return e.distance_km <= radiusKm * 0.5; // Half the radius for "nearby"
      }
      return true; // Include if no distance info
    });

    // Filter for future events with dates
    const futureEvents = nearbyEvents.filter(
      (e) => e.event_date && new Date(e.event_date) >= new Date()
    );

    // Fallback: if no future nearby events, show any nearby events
    let resultEvents = futureEvents.length > 0 ? futureEvents : nearbyEvents;

    // Sort by distance (closest first)
    return [...resultEvents]
      .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
      .slice(0, 10);
  }

  getWeights(): ContextualWeights {
    return {
      category: 0.2,
      time: 0.15,
      social: 0.15,
      match: 0.1,
      distance: 0.4,
    };
  }
}

/**
 * "Pulse" Rail - Big-picture belonging and social proof
 * Priority: 5
 */
class PulseRailProvider extends BaseRailProvider {
  readonly type: RailType = "pulse";
  readonly priority = 5;
  private readonly TOP_TRENDING_PERCENTAGE = 0.4; // Show top 40% of events by attendance

  protected getAnimationStyle(): RailMetadata["animationStyle"] {
    return "wave";
  }

  filterEvents(
    events: EventWithAttendees[],
    _context: RailContext,
  ): EventWithAttendees[] {
    // Filter for trending/popular events (high social proof)
    // Sort all future events by attendance
    const sortedByAttendance = [...events]
      .filter((e) => e.event_date && new Date(e.event_date) >= new Date())
      .filter((e) => (e.attendee_count || 0) >= 2) // Minimum threshold
      .sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0));

    // Show only top percentage by attendance to focus on truly trending events
    const topCount = Math.max(1, Math.ceil(sortedByAttendance.length * this.TOP_TRENDING_PERCENTAGE));
    const trendingEvents = sortedByAttendance.slice(0, topCount);

    // Fallback: if no trending events, show top matched future events with dates
    let resultEvents = trendingEvents;
    if (resultEvents.length === 0) {
      resultEvents = events
        .filter((e) => e.event_date && new Date(e.event_date) >= new Date())
        .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0))
        .slice(0, 10);
    }

    // Return up to 10 events
    return resultEvents.slice(0, 10);
  }

  getWeights(): ContextualWeights {
    return {
      category: 0.15,
      time: 0.15,
      social: 0.35,
      match: 0.1,
      distance: 0.05,
      localVenue: 0.2,
    };
  }
}

/**
 * Registry of all rail providers
 */
class RailProviderRegistry {
  private providers: Map<RailType, RailProvider> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new ForYouRailProvider());
    this.register(new RitualsRailProvider());
    this.register(new ThisWeekendRailProvider());
    this.register(new LocationRailProvider());
    this.register(new PulseRailProvider());
  }

  /**
   * Register a rail provider
   */
  register(provider: RailProvider): void {
    this.providers.set(provider.type, provider);
  }

  /**
   * Get a specific provider by type
   */
  get(type: RailType): RailProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all providers sorted by priority
   */
  getAllSorted(): RailProvider[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => a.priority - b.priority,
    );
  }

  /**
   * Generate all rail results for a set of events
   */
  generateRails(
    events: EventWithAttendees[],
    context: RailContext,
  ): RailResult[] {
    const results: RailResult[] = [];

    for (const provider of this.getAllSorted()) {
      const filteredEvents = provider.filterEvents(events, context);
      const shouldShow = filteredEvents.length > 0;

      results.push({
        metadata: provider.getMetadata(context),
        events: filteredEvents,
        shouldShow,
      });
    }

    return results.filter((r) => r.shouldShow);
  }
}

// Singleton instance
export const railRegistry = new RailProviderRegistry();

/**
 * Export individual providers for testing
 */
export {
  ForYouRailProvider,
  RitualsRailProvider,
  ThisWeekendRailProvider,
  LocationRailProvider,
  PulseRailProvider,
  RailProviderRegistry,
};
