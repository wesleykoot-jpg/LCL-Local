/**
 * Ritual Detection Engine
 * 
 * Detects "Temporal Stability" - events that repeat at the same time/place
 * for 3+ consecutive cycles. These are the "anchors" that create social rhythm.
 * 
 * Detection methods:
 * 1. Keyword matching (weekly, monthly, recurring, etc.)
 * 2. Venue + time pattern analysis
 * 3. Title similarity with temporal patterns
 */

import type { EventWithAttendees } from "../hooks/hooks";
import type { 
  RitualDetectionConfig, 
  RitualEventMeta,
} from "./types";
import { DEFAULT_RITUAL_CONFIG } from "./types";

/**
 * Normalize a string for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Check if event title/description contains ritual keywords
 */
export function hasRitualKeywords(
  event: EventWithAttendees,
  keywords: string[] = DEFAULT_RITUAL_CONFIG.ritualKeywords
): boolean {
  const title = normalizeString(event.title || "");
  const description = normalizeString(event.description || "");
  const combined = `${title} ${description}`;
  
  return keywords.some(keyword => combined.includes(keyword.toLowerCase()));
}

/**
 * Extract day of week from an event date
 */
export function getEventDayOfWeek(eventDate: string | null): string | null {
  if (!eventDate) return null;
  const date = new Date(eventDate);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Extract hour from event time for pattern matching
 */
export function getEventHour(eventTime: string | null): number | null {
  if (!eventTime) return null;
  
  // Handle various time formats
  const match = eventTime.match(/^(\d{1,2}):?/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Check if two events occur at similar times (within window)
 */
export function areSimilarTimes(
  time1: string | null,
  time2: string | null,
  windowHours: number = 2
): boolean {
  const hour1 = getEventHour(time1);
  const hour2 = getEventHour(time2);
  
  if (hour1 === null || hour2 === null) return false;
  
  return Math.abs(hour1 - hour2) <= windowHours;
}

/**
 * Check if two events are at the same venue
 */
export function areSameVenue(
  event1: EventWithAttendees,
  event2: EventWithAttendees
): boolean {
  const venue1 = normalizeString(event1.venue_name || "");
  const venue2 = normalizeString(event2.venue_name || "");
  
  if (!venue1 || !venue2) return false;
  
  return venue1 === venue2;
}

/**
 * Check if two event titles suggest they're the same series
 * (e.g., "Jazz Night" and "Jazz Night #12")
 */
export function areSimilarTitles(
  title1: string,
  title2: string
): boolean {
  const normalized1 = normalizeString(title1);
  const normalized2 = normalizeString(title2);
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Remove common suffixes like numbers, #, etc.
  const cleanPattern = /\s*[#\-–]\s*\d+\s*$/;
  const clean1 = normalized1.replace(cleanPattern, "");
  const clean2 = normalized2.replace(cleanPattern, "");
  
  if (clean1 === clean2) return true;
  
  // Check if one contains the other (for series names)
  if (clean1.length > 3 && clean2.length > 3) {
    return clean1.includes(clean2) || clean2.includes(clean1);
  }
  
  return false;
}

/**
 * Group events that appear to be part of the same recurring series
 */
export function groupRecurringEvents(
  events: EventWithAttendees[],
  config: RitualDetectionConfig = DEFAULT_RITUAL_CONFIG
): Map<string, EventWithAttendees[]> {
  const groups = new Map<string, EventWithAttendees[]>();
  
  for (const event of events) {
    let matchedGroup: string | null = null;
    
    // Try to find an existing group this event belongs to
    for (const [groupKey, groupEvents] of groups) {
      const firstEvent = groupEvents[0];
      
      // Check if same venue and similar title
      if (areSameVenue(event, firstEvent) && areSimilarTitles(event.title, firstEvent.title)) {
        // Check if occurs on same day of week
        const eventDay = getEventDayOfWeek(event.event_date);
        const firstEventDay = getEventDayOfWeek(firstEvent.event_date);
        
        if (eventDay === firstEventDay) {
          // Check if similar time
          if (areSimilarTimes(event.event_time, firstEvent.event_time, config.timeWindowHours)) {
            matchedGroup = groupKey;
            break;
          }
        }
      }
    }
    
    if (matchedGroup) {
      groups.get(matchedGroup)!.push(event);
    } else {
      // Create new group with unique key
      const groupKey = `${event.venue_name || "unknown"}_${event.title}_${Date.now()}_${Math.random()}`;
      groups.set(groupKey, [event]);
    }
  }
  
  return groups;
}

/**
 * Detect ritual metadata for an event
 */
export function detectRitualMeta(
  event: EventWithAttendees,
  allEvents: EventWithAttendees[],
  userAttendedIds: Set<string> = new Set(),
  config: RitualDetectionConfig = DEFAULT_RITUAL_CONFIG
): RitualEventMeta {
  // Check for keyword-based rituals
  if (hasRitualKeywords(event, config.ritualKeywords)) {
    const userStreak = calculateUserStreak(event, allEvents, userAttendedIds);
    const dayOfWeek = event.event_date ? getEventDayOfWeek(event.event_date) : null;
    return {
      isRitual: true,
      ritualDay: dayOfWeek ?? undefined,
      userStreak,
    };
  }
  
  // Check for pattern-based rituals
  const groups = groupRecurringEvents(allEvents, config);
  
  for (const [_, groupEvents] of groups) {
    if (groupEvents.some(e => e.id === event.id)) {
      if (groupEvents.length >= config.minOccurrences) {
        const userStreak = calculateUserStreak(event, groupEvents, userAttendedIds);
        const dayOfWeek = event.event_date ? getEventDayOfWeek(event.event_date) : null;
        return {
          isRitual: true,
          occurrenceCount: groupEvents.length,
          ritualDay: dayOfWeek ?? undefined,
          userStreak,
        };
      }
    }
  }
  
  return { isRitual: false };
}

/**
 * Calculate user's participation streak in a ritual series
 */
export function calculateUserStreak(
  currentEvent: EventWithAttendees,
  seriesEvents: EventWithAttendees[],
  userAttendedIds: Set<string>
): number {
  if (!currentEvent.event_date) return 0;
  const currentDate = currentEvent.event_date;
  
  // Sort events by date (most recent first), filter out events without dates
  const sortedEvents = [...seriesEvents]
    .filter(e => e.event_date && new Date(e.event_date) <= new Date(currentDate))
    .sort((a, b) => new Date(b.event_date!).getTime() - new Date(a.event_date!).getTime());
  
  let streak = 0;
  
  for (const event of sortedEvents) {
    if (userAttendedIds.has(event.id)) {
      streak++;
    } else {
      break; // Streak broken
    }
  }
  
  return streak;
}

/**
 * Filter events to only include rituals
 */
export function filterRitualEvents(
  events: EventWithAttendees[],
  config: RitualDetectionConfig = DEFAULT_RITUAL_CONFIG
): EventWithAttendees[] {
  // First, get all keyword-based rituals
  const keywordRituals = events.filter(e => hasRitualKeywords(e, config.ritualKeywords));
  
  // Then, group remaining events to find pattern-based rituals
  const remainingEvents = events.filter(e => !hasRitualKeywords(e, config.ritualKeywords));
  const groups = groupRecurringEvents(remainingEvents, config);
  
  const patternRituals: EventWithAttendees[] = [];
  for (const [_, groupEvents] of groups) {
    if (groupEvents.length >= config.minOccurrences) {
      // Only include upcoming events from the ritual series (filter out events without dates)
      const upcomingFromGroup = groupEvents.filter(
        e => e.event_date && new Date(e.event_date) >= new Date()
      );
      patternRituals.push(...upcomingFromGroup);
    }
  }
  
  // Combine and deduplicate
  const allRituals = new Map<string, EventWithAttendees>();
  [...keywordRituals, ...patternRituals].forEach(e => {
    allRituals.set(e.id, e);
  });
  
  return Array.from(allRituals.values());
}

/**
 * Get upcoming ritual events with their metadata
 */
export function getRitualEventsWithMeta(
  events: EventWithAttendees[],
  userAttendedIds: Set<string> = new Set(),
  config: RitualDetectionConfig = DEFAULT_RITUAL_CONFIG
): Array<EventWithAttendees & { ritualMeta: RitualEventMeta }> {
  const ritualEvents = filterRitualEvents(events, config);
  
  return ritualEvents.map(event => ({
    ...event,
    ritualMeta: detectRitualMeta(event, events, userAttendedIds, config),
  }));
}
