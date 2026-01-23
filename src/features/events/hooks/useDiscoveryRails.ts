import { useMemo } from "react";
import type {
  DiscoveryLayout,
  DiscoverySection,
} from "../types/discoveryTypes.ts";
import type { EventWithAttendees } from "./hooks.ts";
import { groupEventsIntoStacks } from "../api/feedGrouping.ts";

interface UseDiscoveryRailsOptions {
  allEvents: EventWithAttendees[];
  userId?: string;
  userLocation?: { lat: number; lng: number };
  radiusKm?: number;
  enabled?: boolean;
  selectedCategories?: string[];
}

export function useDiscoveryRails({
  allEvents,
  userId,
  userLocation, // kept for dependency tracking
  radiusKm = 25,
  enabled = true,
  selectedCategories = [],
}: UseDiscoveryRailsOptions) {
  // We use userId and userLocation in the dependency array to ensure rails refresh
  // if the user switches accounts or moves significantly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dependencies = [
    allEvents,
    userId,
    userLocation?.lat,
    userLocation?.lng,
    radiusKm,
    enabled,
    selectedCategories,
  ];

  return useMemo<DiscoveryLayout>(() => {
    if (!enabled || !allEvents || allEvents.length === 0) {
      return { sections: [] };
    }

    const sections: DiscoverySection[] = [];

    // --- Rail 1: "Your Local Pulse" (Personalized/Engagement) ---
    // High-engagement events matching user's category preferences.
    let pulseEvents = allEvents;
    if (selectedCategories.length > 0) {
      pulseEvents = allEvents.filter((e) =>
        selectedCategories.includes(e.category),
      );
    }
    // Fallback if no categories selected or no matches: top attended events
    if (pulseEvents.length === 0) pulseEvents = allEvents;

    // Sort by attendee count desc
    pulseEvents = [...pulseEvents]
      .sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0))
      .slice(0, 8);

    if (pulseEvents.length > 0) {
      sections.push({
        type: "traditional",
        title: "Your Local Pulse",
        description: "Popular events matching your vibe",
        items: pulseEvents,
        layout: "carousel",
      });
    }

    // --- Rail 2: "The Wildcard" (Generic/Discovery) ---
    // Events from categories the user has NOT selected (or random if none selected).
    let wildcardEvents: EventWithAttendees[] = [];
    if (selectedCategories.length > 0) {
      wildcardEvents = allEvents.filter(
        (e) => !selectedCategories.includes(e.category),
      );
    } else {
      // If no preferences, pick random categories or just shuffle
      wildcardEvents = [...allEvents];
    }

    // Shuffle/Randomize to ensure variety, take top 8
    wildcardEvents = wildcardEvents.sort(() => 0.5 - Math.random()).slice(0, 8);

    if (wildcardEvents.length > 0) {
      sections.push({
        type: "generative",
        title: "The Wildcard",
        description: "Step outside your comfort zone",
        items: wildcardEvents,
        layout: "carousel",
      });
    }

    // --- Rail 3: "Community Rituals" (Social/Stacks) ---
    // Recurring stacks (events with forks).
    const allStacks = groupEventsIntoStacks(allEvents);
    const ritualStacks = allStacks.filter(
      (stack) => stack.type === "stack" && stack.forks.length > 0,
    );

    // For the rail, we display the ANCHOR events of these stacks
    const ritualEvents = ritualStacks.map((s) => s.anchor).slice(0, 8);

    if (ritualEvents.length > 0) {
      sections.push({
        type: "social",
        title: "Community Rituals",
        description: "Weekly meetups and recurring groups",
        items: ritualEvents,
        layout: "carousel",
      });
    }

    // --- Rail 4: "Hidden Gems" (Generic/Algorithm) ---
    // Low attendee count (< 5) BUT high match percentage (> 80%).
    const hiddenEvents = allEvents
      .filter((e) => (e.attendee_count || 0) < 5)
      .filter((e) => (e.match_percentage || 0) > 80)
      .slice(0, 8);

    if (hiddenEvents.length > 0) {
      sections.push({
        type: "generative",
        title: "Hidden Gems",
        description: "Highly matched, small crowds",
        items: hiddenEvents,
        layout: "carousel",
      });
    }

    // --- Rail 5: "Neighborhood Serendipity" (Location/Generic) ---
    // Events within very tight radius (< 2km).
    // Uses distance_km from backend provided data
    let serendipityEvents: EventWithAttendees[] = [];

    serendipityEvents = allEvents.filter((e) => {
      return typeof e.distance_km === "number" && e.distance_km < 2.0;
    });

    // Sort by closest distance
    serendipityEvents
      .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
      .slice(0, 8);

    if (serendipityEvents.length > 0) {
      sections.push({
        type: "utility", // Using utility icon for location
        title: "Neighborhood Serendipity",
        description: "Right around the corner (< 2km)",
        items: serendipityEvents,
        layout: "carousel",
      });
    }

    return { sections };
  }, dependencies);
}
