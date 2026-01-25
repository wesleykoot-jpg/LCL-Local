import { useMemo } from "react";
import type {
  DiscoveryLayout,
  DiscoverySection,
  DiscoverySectionType,
} from "../types/discoveryTypes.ts";
import type { EventWithAttendees } from "./hooks.ts";
import { 
  railRegistry, 
  type RailContext, 
  type RailType 
} from "../discovery/index.ts";

interface UseDiscoveryRailsOptions {
  allEvents: EventWithAttendees[];
  enabled?: boolean;
  selectedCategories?: string[];
  bookmarkedEvents?: EventWithAttendees[];
  locationCity?: string;
  country?: string;
  userLocation?: { lat: number; lng: number } | null;
  radiusKm?: number;
  profileId?: string;
  attendedEventIds?: Set<string>;
}

/**
 * Map rail types to section types for backward compatibility
 */
const railTypeToSectionType: Record<RailType, DiscoverySectionType> = {
  "for-you": "traditional",
  "rituals": "social",
  "this-weekend": "traditional",
  "location": "utility",
  "pulse": "traditional",
};

/**
 * useDiscoveryRails - Strategy-based Discovery Rails Hook
 * 
 * Implements the 5 Psychological Pillars:
 * 1. "For You" (The Ego) - Validation through personalization
 * 2. "Rituals" (The Habit) - Stability through recurring events
 * 3. "This Weekend" (The Reward) - Temporal anticipation
 * 4. "Happening in [Location]" (The Grounding) - Physical connection
 * 5. "Pulse of [Country]" (The Collective) - Big-picture belonging
 */
export function useDiscoveryRails({
  allEvents,
  enabled = true,
  selectedCategories = [],
  bookmarkedEvents = [],
  locationCity,
  country,
  userLocation,
  radiusKm = 25,
  profileId,
  attendedEventIds = new Set(),
}: UseDiscoveryRailsOptions) {
  return useMemo<DiscoveryLayout>(() => {
    if (!enabled || !allEvents || allEvents.length === 0) {
      return { sections: [] };
    }

    const sections: DiscoverySection[] = [];

    // Build the rail context for providers
    const context: RailContext = {
      selectedCategories,
      locationCity,
      country,
      userLocation,
      radiusKm,
      profileId,
      bookmarkedEventIds: new Set(bookmarkedEvents.map(e => e.id)),
      attendedEventIds,
    };

    // --- Rail 0: "Saved for later" (Special rail, not in registry) ---
    if (bookmarkedEvents.length > 0) {
      sections.push({
        type: "traditional",
        title: "Saved for later",
        description: "Your hearted events we thought you'd love",
        items: bookmarkedEvents,
        layout: "carousel",
      });
    }

    // --- Generate rails from the registry ---
    const railResults = railRegistry.generateRails(allEvents, context);

    for (const result of railResults) {
      // Always add rails, even if empty (for empty state display)
      if (result.shouldShow) {
        sections.push({
          type: railTypeToSectionType[result.metadata.type] || "traditional",
          title: result.metadata.title,
          description: result.metadata.description,
          items: result.events, // Can be empty array
          layout: "carousel",
          // Store additional metadata for the renderer
          icon: undefined, // Will be rendered by DynamicRailRenderer based on type
        });
      }
    }

    // --- Bonus Rail: "Hidden Gems" (Generative) ---
    const hiddenEvents = allEvents
      .filter((e) => (e.attendee_count || 0) < 5)
      .filter((e) => !!e.image_url)
      .filter((e) => e.event_date && new Date(e.event_date) >= new Date())
      .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0))
      .slice(0, 10);

    if (hiddenEvents.length > 0) {
      sections.push({
        type: "generative",
        title: "Hidden Gems",
        description: "Highly matched, small crowds",
        items: hiddenEvents,
        layout: "carousel",
      });
    }

    return { sections };
  }, [
    allEvents, 
    enabled, 
    selectedCategories, 
    bookmarkedEvents,
    locationCity,
    country,
    userLocation,
    radiusKm,
    profileId,
    attendedEventIds,
  ]);
}
