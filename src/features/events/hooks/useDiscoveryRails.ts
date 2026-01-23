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
  userLocation,
  radiusKm = 25,
  enabled = true,
  selectedCategories = [],
}: UseDiscoveryRailsOptions) {
  return useMemo<DiscoveryLayout>(() => {
    if (!enabled || !allEvents || allEvents.length === 0) {
      return { sections: [] };
    }

    const sections: DiscoverySection[] = [];

    // --- Rail 1: "Your Local Pulse" (Personalized/Engagement) ---
    let pulseEvents = allEvents;
    if (selectedCategories.length > 0) {
      pulseEvents = allEvents.filter((e) =>
        selectedCategories.includes(e.category),
      );
    }
    if (pulseEvents.length === 0) pulseEvents = allEvents;

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

    // --- Rail 2: "The Wildcard" (Generative) ---
    let wildcardEvents: EventWithAttendees[] = [];
    if (selectedCategories.length > 0) {
      wildcardEvents = allEvents.filter(
        (e) => !selectedCategories.includes(e.category),
      );
    } else {
      wildcardEvents = [...allEvents];
    }
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
    const ritualKeywords = [
      "weekly",
      "monthly",
      "yearly",
      "club",
      "meetup",
      "class",
      "group",
      "borrel",
      "ritueel",
      "training",
    ];
    const ritualEventsFromKeywords = allEvents.filter((e) => {
      const title = e.title.toLowerCase();
      const desc = (e.description || "").toLowerCase();
      return ritualKeywords.some(
        (kw) => title.includes(kw) || desc.includes(kw),
      );
    });

    const allStacks = groupEventsIntoStacks(allEvents);
    const ritualStacks = allStacks.filter(
      (stack) => stack.type === "stack" && stack.forks.length > 0,
    );
    const ritualEventsFromStacks = ritualStacks.map((s) => s.anchor);

    const combinedRitualEvents = Array.from(
      new Set([...ritualEventsFromKeywords, ...ritualEventsFromStacks]),
    ).slice(0, 8);

    if (combinedRitualEvents.length > 0) {
      sections.push({
        type: "social",
        title: "Community Rituals",
        description: "Weekly meetups and recurring groups",
        items: combinedRitualEvents,
        layout: "carousel",
      });
    }

    // --- Rail 4: "Hidden Gems" (Generative) ---
    const hiddenEvents = allEvents
      .filter((e) => (e.attendee_count || 0) < 5)
      .filter((e) => !!e.image_url)
      .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0))
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

    // --- Rail 5: "Neighborhood Serendipity" (Location) ---
    const serendipityEvents = allEvents.filter((e) => {
      return typeof e.distance_km === "number" && e.distance_km < 2.0;
    });

    serendipityEvents
      .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
      .slice(0, 8);

    if (serendipityEvents.length > 0) {
      sections.push({
        type: "utility",
        title: "Neighborhood Serendipity",
        description: "Right around the corner (< 2km)",
        items: serendipityEvents,
        layout: "carousel",
      });
    }

    return { sections };
  }, [
    allEvents,
    userId,
    userLocation?.lat,
    userLocation?.lng,
    radiusKm,
    enabled,
    selectedCategories,
  ]);
}
