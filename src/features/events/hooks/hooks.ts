import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { joinEvent, checkEventAttendance } from '../api/eventService';
import { hapticNotification } from '@/shared/lib/haptics';
import toast from 'react-hot-toast';
import type { Database } from '@/integrations/supabase/types';

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

export function usePersonaStats(profileId: string) {
  const [stats, setStats] = useState<PersonaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch all persona stats and combine them
        const { data, error } = await supabase
          .from('persona_stats')
          .select('*')
          .eq('profile_id', profileId);

        if (error) throw error;
        
        // Combine stats from all persona types
        if (data && data.length > 0) {
          const combined: PersonaStats = {
            ...data[0],
            rallies_hosted: data.reduce((sum, s) => sum + (s.rallies_hosted || 0), 0),
            newcomers_welcomed: data.reduce((sum, s) => sum + (s.newcomers_welcomed || 0), 0),
            host_rating: data.reduce((sum, s) => sum + (s.host_rating || 0), 0) / data.length,
          };
          setStats(combined);
        } else {
          setStats(null);
        }
      } catch (e) {
        console.error('Error fetching persona stats:', e);
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      fetchStats();
    }
  }, [profileId]);

  return { stats, loading };
}

export function usePersonaBadges(profileId: string) {
  const [badges, setBadges] = useState<PersonaBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBadges() {
      try {
        // Fetch all badges regardless of persona type
        const { data, error } = await supabase
          .from('persona_badges')
          .select('*')
          .eq('profile_id', profileId);

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
  }, [profileId]);

  return { badges, loading };
}

export function useEvents(options?: {
  category?: string[];
  eventType?: string[];
  userLocation?: { lat: number; lng: number };
  radiusKm?: number;
  page?: number;
  pageSize?: number;
  currentUserProfileId?: string;
}) {
  const [events, setEvents] = useState<EventWithAttendees[]>([]);
  const [loading, setLoading] = useState(true);

  // Stabilize dependency keys to prevent re-renders from reference changes
  const categoryKey = options?.category?.join(',') ?? '';
  const eventTypeKey = options?.eventType?.join(',') ?? '';
  const currentUserProfileId = options?.currentUserProfileId ?? '';

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all events with attendees in a single query to solve N+1 problem
      // Limit attendees to first 4 per event to keep it light
      // Supabase default limit is 1000 rows which is sufficient for our use case
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
        .limit(ATTENDEE_LIMIT, { foreignTable: 'event_attendees' });

      if (options?.category && options.category.length > 0) {
        query = query.in('category', options.category);
      }

      if (options?.eventType && options.eventType.length > 0) {
        query = query.in('event_type', options.eventType);
      }

      const { data, error } = await query;

      if (error) throw error;

      let eventsWithData = (data || []).map(event => {
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

      // If currentUserProfileId is provided, fetch user's attendance for each event
      // to ensure the "Joined" state is accurate even if user is not in first 4 attendees
      if (options?.currentUserProfileId && eventsWithData.length > 0) {
        const eventIds = eventsWithData.map(e => e.id);
        const { data: userAttendances } = await supabase
          .from('event_attendees')
          .select('event_id, profile_id, profiles(id, avatar_url, full_name)')
          .eq('profile_id', options.currentUserProfileId)
          .in('event_id', eventIds);

        if (userAttendances) {
          // Add current user to attendees list if they've joined but aren't in the first 4
          eventsWithData = eventsWithData.map(event => {
            const userAttendance = userAttendances.find(a => a.event_id === event.id);
            if (userAttendance) {
              // Check if user is already in attendees list
              const isInList = event.attendees?.some(a => a.profile?.id === options.currentUserProfileId);
              if (!isInList && userAttendance.profiles) {
                // Add user to beginning of attendees list
                return {
                  ...event,
                  attendees: [{
                    profile: {
                      id: userAttendance.profiles.id,
                      avatar_url: userAttendance.profiles.avatar_url,
                      full_name: userAttendance.profiles.full_name,
                    }
                  }, ...(event.attendees || [])]
                };
              }
            }
            return event;
          });
        }
      }

      setEvents(eventsWithData);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('Error fetching events:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [categoryKey, eventTypeKey, currentUserProfileId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
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
      if (!profileId) {
        toast.error('Please sign in to join events');
        return;
      }

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
        if (error instanceof Error && error.message === 'already_joined') {
          await hapticNotification('warning');
          toast.error("You're already attending this event");
          return;
        }
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
