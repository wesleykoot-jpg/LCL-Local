import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventService } from "../api/eventService";
import { useAuth } from "@/features/auth";
import { useGoogleCalendar } from "@/features/calendar/hooks/useGoogleCalendar";
import { queryKeys } from "@/shared/config/queryKeys";
import { queryKeys } from "@/shared/config/queryKeys";

export type ItineraryItemType = "LCL_EVENT" | "GOOGLE_CALENDAR";

export interface ItineraryItem {
  id: string;
  type: ItineraryItemType;
  title: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  image?: string;
  status: "confirmed" | "tentative" | "pending";
  category?: string;
  attendeeCount?: number;
  ticketNumber?: string;
  originalData: any;
  conflictType?: "overlap" | null;
}

/**
 * Detect time overlaps between itinerary items
 */
function detectTimeOverlaps(items: ItineraryItem[]): ItineraryItem[] {
  const cloned = items.map((i) => ({
    ...i,
    conflictType: null as "overlap" | null,
  }));
  const sorted = cloned
    .slice()
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevEnd = (prev.endTime ?? prev.startTime).getTime();
    const curStart = cur.startTime.getTime();
    if (curStart < prevEnd) {
      prev.conflictType = "overlap";
      cur.conflictType = "overlap";
    }
  }
  const byId = new Map(sorted.map((it) => [it.id, it]));
  return items.map(
    (orig) => byId.get(orig.id) ?? { ...orig, conflictType: null },
  );
}

export const useUnifiedItinerary = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { calendarEvents } = useGoogleCalendar() as any;

  // Use profile.id if available
  const effectiveUserId = profile?.id;

  // 1. Fetch "My Events" (Joined/Attending)
  const { data: myEvents } = useQuery({
    queryKey: queryKeys.profile.myEvents(effectiveUserId || "anon"),
    queryFn: () =>
      effectiveUserId
        ? eventService.fetchUserEvents(effectiveUserId)
        : Promise.resolve([]),
    enabled: !!effectiveUserId,
    staleTime: 0, // Always fetch fresh
  });

  // 2. Merge Real Events
  const timelineItems = useMemo(() => {
    const items: ItineraryItem[] = [];

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
        if (event.event_time && event.event_time !== "TBD") {
          const timeMatch = event.event_time.match(/^(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            startTime.setHours(
              parseInt(timeMatch[1], 10),
              parseInt(timeMatch[2], 10),
            );
          }
        }

        items.push({
          id: event.id,
          type: "LCL_EVENT",
          title: event.title,
          startTime,
          location: event.venue_name || event.location,
          image: event.image_url,
          category: event.category,
          attendeeCount: event.attendee_count,
          ticketNumber: event.ticket_number,
          status: "confirmed",
          originalData: event,
        });
      });
    }

    // Transform Google Calendar (Real)
    if (calendarEvents && Array.isArray(calendarEvents)) {
      calendarEvents.forEach((evt: any) => {
        items.push({
          id: evt.id,
          type: "GOOGLE_CALENDAR",
          title: evt.summary,
          startTime: new Date(
            evt.start?.dateTime || evt.start?.date || Date.now(),
          ),
          endTime: evt.end
            ? new Date(evt.end.dateTime || evt.end.date)
            : undefined,
          location: evt.location,
          status: "tentative",
          originalData: evt,
        });
      });
    }

    // 3. Detect time overlaps
    const itemsWithConflicts = detectTimeOverlaps(items);

    // 4. Sort by Time
    return itemsWithConflicts.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );
  }, [myEvents, calendarEvents]);

  // 4. Group by Day
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, ItineraryItem[]> = {};
    timelineItems.forEach((item) => {
      const dateKey = item.startTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [timelineItems]);

  return {
    groupedTimeline,
    timelineItems,
    isLoading: false,
    isEmpty: timelineItems.length === 0,
    refresh: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile.myEvents(effectiveUserId || ""),
      }),
  };
};
