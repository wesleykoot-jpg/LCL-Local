import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventService } from '../api/eventService';
import { useAuth } from '@/contexts/useAuth';
import { useGoogleCalendar } from '@/features/calendar/hooks/useGoogleCalendar';
import { Event } from '@/types/event';

export type ItineraryItemType = 'LCL_EVENT' | 'GOOGLE_CALENDAR';

export interface ItineraryItem {
  id: string;
  type: ItineraryItemType;
  title: string;
  startTime: Date;
  location?: string;
  image?: string;
  status: 'confirmed' | 'tentative';
  originalData: any;
}

export const useUnifiedItinerary = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { events: calendarEvents } = useGoogleCalendar();

  // 1. Fetch "My Events" (Joined/Attending)
  const { data: myEvents, isLoading: isEventsLoading } = useQuery({
    queryKey: ['my-events', user?.id],
    queryFn: () => user ? eventService.fetchUserEvents(user.id) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 0, // Always fetch fresh
  });

  // 2. Merge & Transform
  const timelineItems = useMemo(() => {
    const items: ItineraryItem[] = [];

    // Transform LCL Events
    if (myEvents) {
      myEvents.forEach((event: any) => {
        items.push({
          id: event.id,
          type: 'LCL_EVENT',
          title: event.title,
          startTime: new Date(event.date),
          location: event.location,
          image: event.image_url,
          status: 'confirmed',
          originalData: event,
        });
      });
    }

    // Transform Google Calendar
    if (calendarEvents) {
      calendarEvents.forEach((evt: any) => {
        items.push({
          id: evt.id,
          type: 'GOOGLE_CALENDAR',
          title: evt.summary,
          startTime: new Date(evt.start.dateTime || evt.start.date),
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
    isLoading: isEventsLoading,
    isEmpty: timelineItems.length === 0,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['my-events'] })
  };
};
