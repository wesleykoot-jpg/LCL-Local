// Events Feature Module - Public API
// Contains event feed, details, creation, and attendance functionality

// API / Services
export { joinEvent, checkEventAttendance, createEvent } from './api/eventService';
export type { JoinEventParams, CreateEventParams } from './api/eventService';

export { rankEvents } from './api/feedAlgorithm';
export type { EventForRanking, UserPreferences } from './api/feedAlgorithm';

export { groupEventsIntoStacks } from './api/feedGrouping';
export type { EventStack } from './api/feedGrouping';

// Hooks
export { 
  useEvents, 
  useJoinEvent, 
  useUserCommitments, 
  useAllUserCommitments,
  usePersonaStats,
  usePersonaBadges
} from './hooks/hooks';
export type { EventWithAttendees, EventAttendee, AttendeeProfile } from './hooks/hooks';

export { useUnifiedItinerary } from './hooks/useUnifiedItinerary';
export type {
  ItineraryItem,
  ItineraryItemType,
  ItineraryItemStatus,
  GroupedTimeline,
} from './hooks/useUnifiedItinerary';

export { useImageFallback, getEventImage } from './hooks/useImageFallback';

// Components
export { EventStackCard } from './components/EventStackCard';
export { default as EventDetailModal } from './components/EventDetailModal';
export { EventTimeline } from './components/EventTimeline';
export { TimelineEventCard } from './components/TimelineEventCard';
export { ItineraryTimeline } from './components/timeline/ItineraryTimeline';
export { ShadowEventCard } from './components/timeline/ShadowEventCard';
export { CreateEventModal } from './components/CreateEventModal';
export { TimeFilterPills } from './components/TimeFilterPills';
export type { TimeFilter } from './components/TimeFilterPills';
export { CategoryBadge } from './components/CategoryBadge';
export { DistanceBadge } from './components/DistanceBadge';
export { FeaturedEventHero } from './components/FeaturedEventHero';
export { HorizontalEventCarousel } from './components/HorizontalEventCarousel';
export { Facepile } from './components/Facepile';
export { CategorySubscribeCard } from './components/CategorySubscribeCard';

// Pages (for route usage)
export { default as FeedPage } from './Feed';
export { default as MyEventsPage } from './MyEvents';
