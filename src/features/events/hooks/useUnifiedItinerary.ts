import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventService } from '../api/eventService';
import { useAuth } from '@/features/auth';
import { useGoogleCalendar } from '@/features/calendar/hooks/useGoogleCalendar';
import { queryKeys } from '@/shared/config/queryKeys';
import { addHours, addDays, startOfToday, setHours } from 'date-fns';

export type ItineraryItemType = 'LCL_EVENT' | 'GOOGLE_CALENDAR';

export interface ItineraryItem {
  id: string;
  type: ItineraryItemType;
  title: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  image?: string;
  status: 'confirmed' | 'tentative';
  category?: string;
  attendeeCount?: number;
  ticketNumber?: string;
  originalData: any;
}

// 🎭 STATIC MOCK DATA GENERATOR
const getMockItems = (): ItineraryItem[] => {
  const today = startOfToday();
  return [
    {
      id: 'mock-1',
      type: 'GOOGLE_CALENDAR',
      title: 'Strategy Sync w/ Design Team',
      startTime: setHours(today, 10), // 10:00 AM Today
      location: 'Google Meet',
      status: 'tentative',
      originalData: {},
    },
    {
      id: 'mock-2',
      type: 'GOOGLE_CALENDAR',
      title: 'Lunch with Sarah',
      startTime: setHours(today, 13), // 1:00 PM Today
      location: 'De Pijp, Amsterdam',
      status: 'confirmed',
      originalData: {},
    },
    {
      id: 'mock-3',
      type: 'LCL_EVENT',
      title: 'Jazz & Wine Tasting',
      startTime: setHours(addDays(today, 1), 19), // 7:00 PM Tomorrow
      location: 'Blue Note Club',
      image: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&w=800&q=80',
      status: 'confirmed',
      originalData: {
        id: 'mock-3-data',
        title: 'Jazz & Wine Tasting',
        venue_name: 'Blue Note Club',
        event_date: setHours(addDays(today, 1), 19).toISOString(),
        event_time: '19:00',
        image_url: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&w=800&q=80',
        category: 'music',
        attendee_count: 12,
      },
    },
    {
      id: 'mock-4',
      type: 'GOOGLE_CALENDAR',
      title: 'Flight to Berlin',
      startTime: setHours(addDays(today, 2), 9), // 9:00 AM Day after Tomorrow
      location: 'Schiphol Airport',
      status: 'tentative',
      originalData: {},
    }
  ];
};

export const useUnifiedItinerary = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { events: calendarEvents } = useGoogleCalendar();

  // Use profile.id if available, fallback to user.id for dev test users
  const effectiveUserId = profile?.id || user?.id;

  // 1. Fetch "My Events" (Joined/Attending)
  const { data: myEvents, isLoading: isEventsLoading } = useQuery({
    queryKey: queryKeys.profile.myEvents(effectiveUserId || ''),
    queryFn: () => effectiveUserId ? eventService.fetchUserEvents(effectiveUserId) : Promise.resolve([]),
    enabled: !!effectiveUserId,
    staleTime: 0, // Always fetch fresh
  });

  // 2. Merge Real + Mock
  const timelineItems = useMemo(() => {
    const items: ItineraryItem[] = [...getMockItems()]; // Start with Mocks

    // Add Real Joined Events
    if (myEvents && Array.isArray(myEvents)) {
      myEvents.forEach((event: any) => {
        // Parse the date, handling both ISO strings and date-only formats
        let startTime: Date;
        if (event.date) {
          startTime = new Date(event.date);
        } else if (event.event_date) {
          startTime = new Date(event.event_date);
        } else {
          return; // Skip events without dates
        }

        // If we have event_time, update the hours
        if (event.event_time && event.event_time !== 'TBD') {
          const timeMatch = event.event_time.match(/^(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            startTime.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10));
          }
        }

        items.push({
          id: event.id,
          type: 'LCL_EVENT',
          title: event.title,
          startTime,
          location: event.venue_name || event.location,
          image: event.image_url,
          category: event.category,
          attendeeCount: event.attendee_count,
          ticketNumber: event.ticket_number,
          status: 'confirmed',
          originalData: event,
        });
      });
    }

    // Transform Google Calendar (Real)
    if (calendarEvents && Array.isArray(calendarEvents)) {
      calendarEvents.forEach((evt: any) => {
        items.push({
          id: evt.id,
          type: 'GOOGLE_CALENDAR',
          title: evt.summary,
          startTime: new Date(evt.start?.dateTime || evt.start?.date || Date.now()),
          endTime: evt.end ? new Date(evt.end.dateTime || evt.end.date) : undefined,
          location: evt.location,
          status: 'tentative',
          originalData: evt,
        });
      });
    }

    // 3. Sort by Time
    return items.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [myEvents, calendarEvents]);

  // 4. Group by Day
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, ItineraryItem[]> = {};
    timelineItems.forEach(item => {
      const dateKey = item.startTime.toLocaleDateString('en-US', { 
        weekday: 'long', month: 'short', day: 'numeric' 
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [timelineItems]);

  return {
    groupedTimeline,
    timelineItems,
    isLoading: false, // Always false so we see mocks immediately
    isEmpty: timelineItems.length === 0,
    refresh: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.myEvents(effectiveUserId || '') })
  };
};
