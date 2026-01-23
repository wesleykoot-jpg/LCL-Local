import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventService } from "../api/eventService";
import { useAuth } from "@/features/auth";
import { useGoogleCalendar } from "@/features/calendar/hooks/useGoogleCalendar";
import { queryKeys } from "@/shared/config/queryKeys";
import { addDays, startOfToday, setHours } from "date-fns";

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

// 🎭 STATIC MOCK DATA GENERATOR
const getMockItems = (): ItineraryItem[] => {
  const today = startOfToday();
  return [
    {
      id: "mock-1",
      type: "GOOGLE_CALENDAR",
      title: "Strategy Sync w/ Design Team",
      startTime: setHours(today, 10), // 10:00 AM Today
      location: "Google Meet",
      status: "tentative",
      originalData: {},
    },
    {
      id: "mock-2",
      type: "GOOGLE_CALENDAR",
      title: "Lunch with Sarah",
      startTime: setHours(today, 13), // 1:00 PM Today
      location: "De Pijp, Amsterdam",
      status: "confirmed",
      originalData: {},
    },
    {
      id: "mock-3",
      type: "LCL_EVENT",
      title: "Jazz & Wine Tasting",
      startTime: setHours(addDays(today, 1), 19), // 7:00 PM Tomorrow
      location: "Blue Note Club",
      image:
        "https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&w=800&q=80",
      status: "confirmed",
      originalData: {
        id: "mock-3-data",
        title: "Jazz & Wine Tasting",
        venue_name: "Blue Note Club",
        event_date: setHours(addDays(today, 1), 19).toISOString(),
        event_time: "19:00",
        image_url:
          "https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&w=800&q=80",
        category: "music",
        attendee_count: 12,
      },
    },
    {
      id: "mock-4",
      type: "GOOGLE_CALENDAR",
      title: "Flight to Berlin",
      startTime: setHours(addDays(today, 2), 9), // 9:00 AM Day after Tomorrow
      location: "Schiphol Airport",
      status: "tentative",
      originalData: {},
    },
    {
      id: "mock-invite-1",
      type: "LCL_EVENT",
      title: "Secret rooftop party",
      startTime: setHours(addDays(today, 3), 20), // 8:00 PM in 3 days
      location: "Unknown Location",
      image:
        "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
      status: "pending", // Pending Invite!
      category: "social",
      attendeeCount: 5,
      originalData: {
        id: "mock-invite-1-data",
        title: "Secret rooftop party",
        venue_name: "Unknown Location",
        category: "social",
        attendee_count: 5,
      },
    },
  ];
};

/**
 * Detect time overlaps between itinerary items
 * Marks items with conflictType='overlap' if they have strictly overlapping times
 * Adjacent events (end === start) are NOT considered overlaps
 * Items without endTime are treated as zero-length events at startTime
 */
function detectTimeOverlaps(items: ItineraryItem[]): ItineraryItem[] {
  // Clone items and reset conflictType
  const cloned = items.map((i) => ({
    ...i,
    conflictType: null as "overlap" | null,
  }));

  // Sort by startTime for comparison
  const sorted = cloned
    .slice()
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Check each pair for overlaps
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];

    // Get end times (if missing, use startTime for zero-length)
    const prevEnd = (prev.endTime ?? prev.startTime).getTime();
    const curStart = cur.startTime.getTime();

    // Strict overlap check (curStart < prevEnd, not <=)
    if (curStart < prevEnd) {
      prev.conflictType = "overlap";
      cur.conflictType = "overlap";
    }
  }

  // Map back to original order using item IDs
  const byId = new Map(sorted.map((it) => [it.id, it]));
  return items.map(
    (orig) => byId.get(orig.id) ?? { ...orig, conflictType: null },
  );
}

// Dev fallback sample data for when not authenticated
const DEV_SAMPLE_EVENTS = [
  {
    id: "dev-1",
    title: "South African Roadtrip - We Are Family",
    date: new Date().toISOString(),
    event_time: "14:00",
    venue_name: "Sneek Agenda",
    category: "family",
    image_url: null,
    attendee_count: 12,
    location: "Sneek",
    ticket_number: "TKT-DEV-001",
  },
  {
    id: "dev-2",
    title: "Creative Workshop: Art & Design",
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    event_time: "10:00",
    venue_name: "Adoroble Studio",
    category: "entertainment",
    image_url: null,
    attendee_count: 8,
    location: "Adoroble Studio",
    ticket_number: "TKT-DEV-002",
  },
  {
    id: "dev-3",
    title: "Leeuwarden Free Tour",
    date: new Date(Date.now() + 86400000 * 2).toISOString(), // Day after tomorrow
    event_time: "12:00",
    venue_name: "A Guide to Leeuwarden",
    category: "music",
    image_url: null,
    attendee_count: 25,
    location: "Leeuwarden",
    ticket_number: "TKT-DEV-003",
  },
];

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
