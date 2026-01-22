// Re-export the new TanStack Query-based hooks
export { useEventsQuery } from './useEventsQuery';
export { useLiveEventsQuery } from './useLiveEventsQuery';

// Re-export unified itinerary hook
export { 
  useUnifiedItinerary,
  type ItineraryItem,
  type ItineraryItemType,
} from './useUnifiedItinerary';

// Re-export existing hooks
export { 
  usePersonaStats, 
  usePersonaBadges, 
  useEvents, 
  useUserCommitments, 
  useAllUserCommitments, 
  useJoinEvent,
  type EventWithAttendees,
  type AttendeeProfile,
  type EventAttendee,
} from './hooks';
