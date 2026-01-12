import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { joinEvent, checkEventAttendance } from './eventService';
import { hapticNotification } from './haptics';
import toast from 'react-hot-toast';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Event = Database['public']['Tables']['events']['Row'];
type PersonaStats = Database['public']['Tables']['persona_stats']['Row'];
type PersonaBadge = Database['public']['Tables']['persona_badges']['Row'];

export interface AttendeeProfile {
  id: string;
  avatar_url: string | null;
  full_name: string;
}

export interface EventAttendee {
  profile: AttendeeProfile | null;
}

export interface EventWithAttendees extends Event {
  attendee_count?: number;
  attendees?: EventAttendee[];
  parent_event?: Event | null;
}

const ATTENDEE_LIMIT = 4;

export function useProfile(profileId?: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);

        if (!profileId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          setProfile(data);
        } else {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .maybeSingle();

          if (error) throw error;
          setProfile(data);
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [profileId]);

  return { profile, loading, error };
}

export function usePersonaStats(profileId: string, personaType: 'family' | 'gamer') {
  const [stats, setStats] = useState<PersonaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase
          .from('persona_stats')
          .select('*')
          .eq('profile_id', profileId)
          .eq('persona_type', personaType)
          .maybeSingle();

        if (error) throw error;
        setStats(data);
      } catch (e) {
        console.error('Error fetching persona stats:', e);
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      fetchStats();
    }
  }, [profileId, personaType]);

  return { stats, loading };
}

export function usePersonaBadges(profileId: string, personaType: 'family' | 'gamer') {
  const [badges, setBadges] = useState<PersonaBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBadges() {
      try {
        const { data, error } = await supabase
          .from('persona_badges')
          .select('*')
          .eq('profile_id', profileId)
          .eq('persona_type', personaType);

        if (error) throw error;
        setBadges(data || []);
      } catch (e) {
        console.error('Error fetching badges:', e);
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      fetchBadges();
    }
  }, [profileId, personaType]);

  return { badges, loading };
}

export function useEvents(options?: {
  category?: string[];
  eventType?: string[];
  userLocation?: { lat: number; lng: number };
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}) {
  const [events, setEvents] = useState<EventWithAttendees[]>([]);
  const [loading, setLoading] = useState(true);

  // Stabilize dependency keys to prevent re-renders from reference changes
  const categoryKey = options?.category?.join(',') ?? '';
  const eventTypeKey = options?.eventType?.join(',') ?? '';
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const paginationKey = `${page}-${pageSize}`;

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch events with attendees in a single query to solve N+1 problem
      // Limit attendees to first 4 per event to keep it light
      const attendeesLimit = ATTENDEE_LIMIT;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('events')
        .select(`
          *,
          attendee_count:event_attendees(count),
          attendees:event_attendees(
            profile:profiles(
              id,
              avatar_url,
              full_name
            )
          )
        `)
        .order('event_date', { ascending: true })
        .range(from, to);

      query = query
        .order('joined_at', { foreignTable: 'attendees', ascending: false })
        .limit(attendeesLimit, { foreignTable: 'attendees' });

      if (options?.category && options.category.length > 0) {
        query = query.in('category', options.category);
      }

      if (options?.eventType && options.eventType.length > 0) {
        query = query.in('event_type', options.eventType);
      }

      const { data, error } = await query;

      if (error) throw error;

      const eventsWithData = (data || []).map(event => {
        // Extract count from nested array
        const count = Array.isArray(event.attendee_count)
          ? event.attendee_count[0]?.count || 0
          : 0;
        
        const attendees = Array.isArray(event.attendees)
          ? event.attendees as EventAttendee[]
          : [];

        return {
          ...event,
          attendee_count: count,
          attendees,
        };
      });

      setEvents(eventsWithData);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('Error fetching events:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [categoryKey, eventTypeKey, paginationKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}

export function useEventWithSidecars(parentEventId: string) {
  const [event, setEvent] = useState<EventWithAttendees | null>(null);
  const [sidecars, setSidecars] = useState<EventWithAttendees[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEventAndSidecars() {
      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select(`
            *,
            attendee_count:event_attendees(count)
          `)
          .eq('id', parentEventId)
          .maybeSingle();

        if (eventError) throw eventError;

        if (eventData) {
          setEvent({
            ...eventData,
            attendee_count: Array.isArray(eventData.attendee_count)
              ? eventData.attendee_count[0]?.count || 0
              : 0,
          });

          const { data: sidecarData, error: sidecarError } = await supabase
            .from('events')
            .select(`
              *,
              attendee_count:event_attendees(count)
            `)
            .eq('parent_event_id', parentEventId);

          if (sidecarError) throw sidecarError;

          const sidecarsWithCount = (sidecarData || []).map(sidecar => ({
            ...sidecar,
            attendee_count: Array.isArray(sidecar.attendee_count)
              ? sidecar.attendee_count[0]?.count || 0
              : 0,
          }));

          setSidecars(sidecarsWithCount);
        }
      } catch (e) {
        console.error('Error fetching event and sidecars:', e);
      } finally {
        setLoading(false);
      }
    }

    if (parentEventId) {
      fetchEventAndSidecars();
    }
  }, [parentEventId]);

  return { event, sidecars, loading };
}

export function useUserCommitments(profileId: string) {
  const [commitments, setCommitments] = useState<Array<EventWithAttendees & { ticket_number?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCommitments() {
      try {
        const { data, error } = await supabase
          .from('event_attendees')
          .select(`
            *,
            event:events(*)
          `)
          .eq('profile_id', profileId)
          .eq('status', 'going')
          .order('joined_at', { ascending: false })
          .limit(3);

        if (error) throw error;

        const commitmentsWithEvents = (data || []).map(attendance => ({
          ...attendance.event,
          ticket_number: attendance.ticket_number,
        })) as Array<EventWithAttendees & { ticket_number?: string }>;

        setCommitments(commitmentsWithEvents);
      } catch (e) {
        console.error('Error fetching commitments:', e);
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      fetchCommitments();
    }
  }, [profileId]);

  return { commitments, loading };
}

interface GroupedEvents {
  [monthYear: string]: Array<EventWithAttendees & { ticket_number?: string }>;
}

/**
 * Fetch ALL user commitments for the timeline view, grouped by month
 */
export function useAllUserCommitments(profileId: string) {
  const [commitments, setCommitments] = useState<Array<EventWithAttendees & { ticket_number?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [groupedByMonth, setGroupedByMonth] = useState<GroupedEvents>({});

  useEffect(() => {
    async function fetchAllCommitments() {
      if (!profileId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('event_attendees')
          .select(`
            *,
            event:events(
              *,
              attendee_count:event_attendees(count)
            )
          `)
          .eq('profile_id', profileId)
          .eq('status', 'going');

        if (error) throw error;

        // Process and sort by event date
        const commitmentsWithEvents = (data || [])
          .map(attendance => {
            const event = attendance.event as unknown as Event & { attendee_count: Array<{ count: number }> };
            return {
              ...event,
              ticket_number: attendance.ticket_number,
              attendee_count: Array.isArray(event?.attendee_count)
                ? event.attendee_count[0]?.count || 0
                : 0,
            };
          })
          .filter(e => e.id) // Filter out null events
          .sort((a, b) => {
            const dateA = new Date(a.event_date);
            const dateB = new Date(b.event_date);
            return dateA.getTime() - dateB.getTime();
          }) as Array<EventWithAttendees & { ticket_number?: string }>;

        setCommitments(commitmentsWithEvents);

        // Group by month
        const grouped: GroupedEvents = {};
        commitmentsWithEvents.forEach(event => {
          const date = new Date(event.event_date);
          const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          if (!grouped[monthYear]) {
            grouped[monthYear] = [];
          }
          grouped[monthYear].push(event);
        });

        setGroupedByMonth(grouped);
      } catch (e) {
        console.error('Error fetching all commitments:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchAllCommitments();
  }, [profileId]);

  return { commitments, loading, groupedByMonth };
}

/**
 * Custom hook for handling event joining with loading states and toast notifications
 * @param profileId - The ID of the user's profile
 * @returns Object with handleJoinEvent function, joiningEvents set, and isJoining helper
 */
export function useJoinEvent(profileId: string | undefined, onSuccess?: () => void) {
  const [joiningEvents, setJoiningEvents] = useState<Set<string>>(new Set());

  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      if (!profileId) return;

      // Use state setter to check if already joining (avoids stale closure)
      let alreadyJoining = false;
      setJoiningEvents((prev) => {
        if (prev.has(eventId)) {
          alreadyJoining = true;
          return prev;
        }
        return new Set(prev).add(eventId);
      });

      if (alreadyJoining) return;

      try {
        // Check if already attending
        const { isAttending, status } = await checkEventAttendance(eventId, profileId);
        if (isAttending) {
          await hapticNotification('warning');
          toast.error(`You're already ${status === 'waitlist' ? 'on the waitlist' : 'attending'} this event`);
          return;
        }

        const { error, waitlisted } = await joinEvent({
          eventId,
          profileId,
          status: 'going',
        });

        if (error) throw error;

        await hapticNotification('success');
        if (waitlisted) {
          toast.success("Event is full! You've been added to the waitlist");
        } else {
          toast.success("You're in! Event added to your calendar");
        }

        // Call refetch callback if provided
        onSuccess?.();
      } catch (error) {
        console.error('Error joining event:', error);
        await hapticNotification('error');
        toast.error('Failed to join event. Please try again.');
      } finally {
        setJoiningEvents((prev) => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
      }
    },
    [profileId, onSuccess]
  );

  const isJoining = useCallback(
    (eventId: string) => joiningEvents.has(eventId),
    [joiningEvents]
  );

  return { handleJoinEvent, joiningEvents, isJoining };
}
