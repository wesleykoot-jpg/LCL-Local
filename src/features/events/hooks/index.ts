// Re-export the new TanStack Query-based hooks
export { useEventsQuery } from './useEventsQuery';

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
