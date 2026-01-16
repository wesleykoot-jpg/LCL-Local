/**
 * Unified Itinerary Hook
 *
 * Merges LCL events with Google Calendar events into a unified timeline.
 * Groups events by day (Today, Tomorrow, or specific dates) and sorts by start time.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth';
import { useGoogleCalendar } from '@/features/calendar';
import { fetchCalendarEvents, type GoogleCalendarExternalEvent } from '@/integrations/googleCalendar';
import { parseEventDateTime } from '@/shared/lib/utils';
import type { EventWithAttendees } from './hooks';

export type ItineraryItemType = 'LCL_EVENT' | 'GOOGLE_CALENDAR';
export type ItineraryItemStatus = 'confirmed' | 'tentative';

export interface ItineraryItemBase {
  id: string;
  type: ItineraryItemType;
  startTime: Date;
  status: ItineraryItemStatus;
  title: string;
  location?: string | null;
  isAllDay?: boolean;
  icon?: string | null;
}

export interface LclItineraryItem extends ItineraryItemBase {
  type: 'LCL_EVENT';
  data: EventWithAttendees & { ticket_number?: string };
}

export interface GoogleItineraryItem extends ItineraryItemBase {
  type: 'GOOGLE_CALENDAR';
  data: GoogleCalendarExternalEvent;
}

export type ItineraryItem = LclItineraryItem | GoogleItineraryItem;

export type GroupedTimeline = Record<string, ItineraryItem[]>;

type EventWithCount = EventWithAttendees & { attendee_count?: Array<{ count: number }> };

const getAttendeeCount = (event: { attendee_count?: Array<{ count: number }> }) =>
  Array.isArray(event?.attendee_count) && event.attendee_count.length > 0
    ? event.attendee_count[0]?.count || 0
    : 0;

const DAY_LABEL_LOCALE = Intl.DateTimeFormat().resolvedOptions().locale;

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDayLabel(date: Date, today: Date): string {
  const dateKey = getDateKey(date);
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

  return date.toLocaleDateString(DAY_LABEL_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function getLclStartTime(event: EventWithAttendees): Date | null {
  const datePart = event.event_date?.split('T')[0]?.split(' ')[0];

  if (event.event_time && datePart) {
    const parsed = parseEventDateTime(datePart, event.event_time);
    if (parsed) {
      return parsed.startDate;
    }
  }

  const fallback = new Date(event.event_date);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  if (datePart) {
    const fallbackDate = new Date(`${datePart}T00:00:00`);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
  }

  return null;
}

function getGoogleStartTime(event: GoogleCalendarExternalEvent): { startTime: Date; isAllDay: boolean } {
  if (event.start.dateTime) {
    return { startTime: new Date(event.start.dateTime), isAllDay: false };
  }

  if (event.start.date) {
    return { startTime: new Date(`${event.start.date}T00:00:00`), isAllDay: true };
  }

  return { startTime: new Date(), isAllDay: false };
}

export function useUnifiedItinerary() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const { isConnected: isGoogleConnected, isLoading: isGoogleConnectionLoading } = useGoogleCalendar();

  const lclQuery = useQuery({
    queryKey: ['my-events', userId],
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      const [attendanceResult, createdEventsResult] = await Promise.all([
        supabase
          .from('event_attendees')
          .select(
            `
              *,
              event:events(
                *,
                attendee_count:event_attendees(count)
              )
            `
          )
          .eq('profile_id', userId)
          .eq('status', 'going'),
        supabase
          .from('events')
          .select('*, attendee_count:event_attendees(count)')
          .eq('created_by', userId),
      ]);

      const { data: attendanceData, error: attendanceError } = attendanceResult;
      const { data: createdEvents, error: createdError } = createdEventsResult;

      if (attendanceError) throw attendanceError;
      if (createdError) throw createdError;

      const commitmentsWithEvents = (attendanceData || [])
        .map(attendance => {
          const event = attendance.event as EventWithCount;
          return {
            ...event,
            ticket_number: attendance.ticket_number,
            attendee_count: getAttendeeCount(event),
          };
        })
        .filter(event => event?.id) as Array<EventWithAttendees & { ticket_number?: string }>;

      const createdByUser = (createdEvents || [])
        .map(event => ({
          ...event,
          attendee_count: getAttendeeCount(event as EventWithCount),
        }))
        .filter(event => event?.id) as Array<EventWithAttendees & { ticket_number?: string }>;

      const merged = new Map<string, EventWithAttendees & { ticket_number?: string }>();
      commitmentsWithEvents.forEach(event => merged.set(event.id, event));
      createdByUser.forEach(event => {
        if (!merged.has(event.id)) {
          merged.set(event.id, event);
        }
      });

      return Array.from(merged.values());
    },
    enabled: Boolean(userId),
  });

  const googleQuery = useQuery({
    queryKey: ['google-calendar-events', userId],
    queryFn: async () => {
      if (!userId || !isGoogleConnected) {
        return [];
      }

      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(timeMin);
      timeMax.setDate(timeMax.getDate() + 30);

      const { events, error } = await fetchCalendarEvents(userId, timeMin, timeMax);
      if (error) {
        throw new Error(error);
      }
      return events;
    },
    enabled: Boolean(userId) && isGoogleConnected,
  });

  const startOfToday = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  }, []);

  const lclItems = useMemo(() => {
    return (lclQuery.data || [])
      .map(event => {
        const startTime = getLclStartTime(event);
        if (!startTime || startTime < startOfToday) {
          return null;
        }

        return {
          id: event.id,
          type: 'LCL_EVENT' as const,
          startTime,
          status: 'confirmed' as const,
          title: event.title,
          location: event.venue_name,
          data: event,
        };
      })
      .filter((item): item is LclItineraryItem => Boolean(item))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [lclQuery.data, startOfToday]);

  const googleItems = useMemo(() => {
    return (googleQuery.data || [])
      .map(event => {
        const { startTime, isAllDay } = getGoogleStartTime(event);
        if (startTime < startOfToday) {
          return null;
        }

        const status = event.status === 'tentative' ? 'tentative' : 'confirmed';

        return {
          id: `google-${event.id}`,
          type: 'GOOGLE_CALENDAR' as const,
          startTime,
          status,
          title: event.summary,
          location: event.location,
          isAllDay,
          data: event,
        };
      })
      .filter((item): item is GoogleItineraryItem => Boolean(item));
  }, [googleQuery.data, startOfToday]);

  const groupedTimeline = useMemo(() => {
    const merged = [...lclItems, ...googleItems].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return merged.reduce<GroupedTimeline>((groups, item) => {
      const label = formatDayLabel(item.startTime, today);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
      return groups;
    }, {});
  }, [lclItems, googleItems]);

  return {
    groupedTimeline,
    isLoading: lclQuery.isLoading || googleQuery.isLoading || isGoogleConnectionLoading,
    isGoogleConnected,
    lclEvents: lclQuery.data || [],
    googleEvents: googleQuery.data || [],
  };
}
