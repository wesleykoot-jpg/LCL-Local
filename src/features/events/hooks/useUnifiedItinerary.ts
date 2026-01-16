/**
 * Unified Itinerary Hook
 * 
 * Merges LCL events with Google Calendar events into a unified timeline.
 * Groups events by day (Today, Tomorrow, specific dates) and sorts by start time.
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { useAllUserCommitments, type EventWithAttendees } from './hooks';
import { 
  isCalendarConnected, 
  fetchCalendarEvents,
  type GoogleCalendarExternalEvent 
} from '@/integrations/googleCalendar';

/**
 * Types of items that can appear in the itinerary
 */
export type ItineraryItemType = 'LCL_EVENT' | 'GOOGLE_CALENDAR' | 'HIDDEN';

/**
 * Visual style for itinerary items
 */
export type ItineraryVisualStyle = 'anchor' | 'shadow';

/**
 * Unified itinerary item interface
 */
export interface ItineraryItem {
  /** Unique identifier */
  id: string;
  /** Type of the item source */
  type: ItineraryItemType;
  /** Display time (e.g., "19:00" or "All Day") */
  time: string;
  /** Visual style for rendering */
  visualStyle: ItineraryVisualStyle;
  /** Raw date for sorting (ISO string) */
  sortDate: string;
  /** Icon to display (emoji or null) */
  icon: string | null;
  /** Title of the event */
  title: string;
  /** Location/venue (optional) */
  location?: string;
  /** Original data */
  data: EventWithAttendees | GoogleCalendarExternalEvent;
}

/**
 * Events grouped by day
 */
export interface DayGroup {
  /** Display label (Today, Tomorrow, or formatted date) */
  label: string;
  /** Date key for sorting (YYYY-MM-DD) */
  dateKey: string;
  /** Is this day in the past */
  isPast: boolean;
  /** Is this day today */
  isToday: boolean;
  /** Items for this day, sorted by time */
  items: ItineraryItem[];
}

/**
 * Format time from various input formats
 */
function formatTimeDisplay(timeStr: string | undefined, dateTimeStr: string | undefined): string {
  // Handle all-day events
  if (!timeStr && !dateTimeStr) {
    return 'All Day';
  }

  // Handle datetime string (ISO format from Google)
  if (dateTimeStr) {
    const date = new Date(dateTimeStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  // Handle HH:MM format
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  return timeStr || 'All Day';
}

/**
 * Get an icon based on event title keywords
 */
function getEventIcon(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('birthday') || lowerTitle.includes('bday')) {
    return '🎂';
  }
  if (lowerTitle.includes('meeting') || lowerTitle.includes('call') || lowerTitle.includes('sync')) {
    return '💼';
  }
  if (lowerTitle.includes('lunch') || lowerTitle.includes('dinner') || lowerTitle.includes('breakfast')) {
    return '🍽️';
  }
  if (lowerTitle.includes('workout') || lowerTitle.includes('gym') || lowerTitle.includes('exercise')) {
    return '💪';
  }
  if (lowerTitle.includes('doctor') || lowerTitle.includes('dentist') || lowerTitle.includes('appointment')) {
    return '🏥';
  }
  if (lowerTitle.includes('flight') || lowerTitle.includes('travel') || lowerTitle.includes('trip')) {
    return '✈️';
  }
  if (lowerTitle.includes('reminder')) {
    return '⏰';
  }
  
  return null;
}

/**
 * Get date key (YYYY-MM-DD) from date
 */
function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get a sortable datetime for an event
 */
function getSortableDateTime(
  eventDate: string,
  eventTime: string | undefined,
  dateTimeStr: string | undefined
): string {
  // For Google Calendar events with dateTime
  if (dateTimeStr) {
    return dateTimeStr;
  }

  // For LCL events or all-day Google events
  const dateKey = eventDate.split('T')[0].split(' ')[0];
  
  if (eventTime && /^\d{1,2}:\d{2}$/.test(eventTime)) {
    // Pad hours to 2 digits (e.g., "9:30" -> "09:30")
    const [hours, minutes] = eventTime.split(':');
    const paddedTime = `${hours.padStart(2, '0')}:${minutes}`;
    return `${dateKey}T${paddedTime}:00`;
  }

  // All-day events sort at the start of the day
  return `${dateKey}T00:00:00`;
}

/**
 * Format day label for display
 */
function formatDayLabel(dateKey: string, today: Date): string {
  const eventDate = new Date(dateKey + 'T00:00:00');
  const todayKey = getDateKey(today);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getDateKey(tomorrow);

  if (dateKey === todayKey) {
    return 'Today';
  }
  if (dateKey === tomorrowKey) {
    return 'Tomorrow';
  }

  return eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Hook to fetch and merge LCL events with Google Calendar events
 */
export function useUnifiedItinerary(filterTab: 'upcoming' | 'past' = 'upcoming') {
  const { profile } = useAuth();
  const profileId = profile?.id || '';

  // Fetch LCL commitments
  const { commitments, loading: lclLoading, groupedByMonth } = useAllUserCommitments(profileId);
  
  // Google Calendar state
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarExternalEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check Google Calendar connection and fetch events
  useEffect(() => {
    async function fetchGoogleEvents() {
      if (!profileId) {
        setIsGoogleConnected(false);
        return;
      }

      try {
        const connected = await isCalendarConnected(profileId);
        setIsGoogleConnected(connected);

        if (!connected) {
          setGoogleEvents([]);
          return;
        }

        setGoogleLoading(true);

        // Fetch events for the next 14 days (and past 90 days for past tab)
        const now = new Date();
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);
        
        const timeMin = filterTab === 'past' 
          ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
          : todayMidnight;
        const timeMax = filterTab === 'past'
          ? todayMidnight
          : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days ahead

        const { events, error } = await fetchCalendarEvents(profileId, timeMin, timeMax);
        
        if (error) {
          console.warn('[useUnifiedItinerary] Google Calendar fetch error:', error);
        }

        setGoogleEvents(events);
      } catch (error) {
        console.error('[useUnifiedItinerary] Error fetching Google events:', error);
        setGoogleEvents([]);
      } finally {
        setGoogleLoading(false);
      }
    }

    fetchGoogleEvents();
  }, [profileId, filterTab, refreshKey]);

  // Merge and group events by day
  const dayGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const groups = new Map<string, DayGroup>();

    // Process LCL events
    commitments.forEach((event) => {
      const dateKey = event.event_date.split('T')[0].split(' ')[0];
      const eventDate = new Date(dateKey + 'T00:00:00');
      const isPast = eventDate.getTime() < todayTime;
      
      // Filter based on tab
      if ((filterTab === 'upcoming' && isPast) || (filterTab === 'past' && !isPast)) {
        return;
      }

      const item: ItineraryItem = {
        id: event.id,
        type: 'LCL_EVENT',
        time: formatTimeDisplay(event.event_time, undefined),
        visualStyle: 'anchor',
        sortDate: getSortableDateTime(event.event_date, event.event_time, undefined),
        icon: null, // LCL events don't need icons
        title: event.title,
        location: event.venue_name,
        data: event,
      };

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          label: formatDayLabel(dateKey, today),
          dateKey,
          isPast,
          isToday: dateKey === getDateKey(today),
          items: [],
        });
      }

      groups.get(dateKey)!.items.push(item);
    });

    // Process Google Calendar events
    googleEvents.forEach((event) => {
      // Skip events that are synced from LCL 
      // Check for LCL marker in description (added when syncing to Google)
      const isLCLSynced = event.description?.toLowerCase().includes('lcl local') ||
                          event.description?.toLowerCase().includes('event from lcl');
      if (isLCLSynced) {
        return;
      }

      // Also check for duplicate titles on the same date/time
      const eventTitle = event.summary.toLowerCase().trim();
      const isDuplicate = commitments.some(lcl => {
        const lclTitle = lcl.title.toLowerCase().trim();
        const lclDateKey = lcl.event_date.split('T')[0].split(' ')[0];
        const googleDateKey = event.start.date || 
          new Date(event.start.dateTime!).toISOString().split('T')[0];
        return lclTitle === eventTitle && lclDateKey === googleDateKey;
      });
      
      if (isDuplicate) {
        return;
      }

      const isAllDay = !event.start.dateTime;
      const dateKey = isAllDay 
        ? event.start.date! 
        : new Date(event.start.dateTime!).toISOString().split('T')[0];
      
      const eventDate = new Date(dateKey + 'T00:00:00');
      const isPast = eventDate.getTime() < todayTime;
      
      // Filter based on tab
      if ((filterTab === 'upcoming' && isPast) || (filterTab === 'past' && !isPast)) {
        return;
      }

      const item: ItineraryItem = {
        id: `google-${event.id}`,
        type: 'GOOGLE_CALENDAR',
        time: formatTimeDisplay(undefined, event.start.dateTime),
        visualStyle: 'shadow',
        sortDate: getSortableDateTime(dateKey, undefined, event.start.dateTime),
        icon: getEventIcon(event.summary),
        title: event.summary,
        location: event.location,
        data: event,
      };

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          label: formatDayLabel(dateKey, today),
          dateKey,
          isPast,
          isToday: dateKey === getDateKey(today),
          items: [],
        });
      }

      groups.get(dateKey)!.items.push(item);
    });

    // Sort items within each day by time, and sort days by date
    const sortedGroups = Array.from(groups.values())
      .map(group => ({
        ...group,
        items: group.items.sort((a, b) => {
          // All-day events come first
          if (a.time === 'All Day' && b.time !== 'All Day') return -1;
          if (a.time !== 'All Day' && b.time === 'All Day') return 1;
          return a.sortDate.localeCompare(b.sortDate);
        }),
      }))
      .sort((a, b) => {
        const comparison = a.dateKey.localeCompare(b.dateKey);
        return filterTab === 'past' ? -comparison : comparison;
      });

    return sortedGroups;
  }, [commitments, googleEvents, filterTab]);

  // Calculate total items
  const totalItems = useMemo(() => 
    dayGroups.reduce((sum, group) => sum + group.items.length, 0),
    [dayGroups]
  );

  // Refresh function to re-fetch Google Calendar events
  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return {
    dayGroups,
    totalItems,
    loading: lclLoading || googleLoading,
    isGoogleConnected,
    refresh,
    // Also expose the original groupedByMonth for backward compatibility
    groupedByMonth,
  };
}
