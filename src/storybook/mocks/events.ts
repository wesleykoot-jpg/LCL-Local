import type { EventWithAttendees } from '@/features/events/hooks/hooks';

/**
 * Mock event data fixtures for Storybook stories
 * 
 * Includes:
 * - Calendar events (imported from Google Calendar)
 * - Discovery/native events (scraped or user-created)
 * - Events with/without images
 * - Edge cases (long descriptions, missing data)
 */

// Base timestamp for consistent dates
const NOW = new Date('2026-01-20T12:00:00Z');
const TODAY = new Date(NOW);
TODAY.setHours(0, 0, 0, 0);

// Helper to create dates relative to NOW
const addDays = (days: number): string => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const addHours = (hours: number): string => {
  const date = new Date(NOW);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

// Mock attendee profiles
const mockAttendees = [
  {
    profile: {
      id: 'user-1',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      full_name: 'Alice Johnson',
    },
  },
  {
    profile: {
      id: 'user-2',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      full_name: 'Bob Smith',
    },
  },
  {
    profile: {
      id: 'user-3',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
      full_name: 'Charlie Davis',
    },
  },
];

// Calendar Event (Google Calendar import) - Simple, flat styling
export const calendarEvent: EventWithAttendees = {
  id: 'cal-event-1',
  title: 'Team Standup Meeting',
  description: 'Daily sync with the team',
  category: 'social',
  event_type: 'anchor',
  event_date: addDays(0),
  event_time: '14:00',
  venue_name: 'Virtual / Zoom',
  location: null,
  status: 'active',
  image_url: null, // Calendar events typically don't have images
  match_percentage: 90,
  attendee_count: 5,
  attendees: mockAttendees,
  created_by: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: null,
  event_fingerprint: null,
  max_attendees: null,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Discovery Event with Image - Glassmorphism styling
export const discoveryEventWithImage: EventWithAttendees = {
  id: 'discovery-1',
  title: 'Indie Film Premiere: Moonlight Stories',
  description: 'Join us for an exclusive screening of the award-winning indie film "Moonlight Stories" followed by a Q&A with the director.',
  category: 'entertainment',
  event_type: 'anchor',
  event_date: addDays(2),
  event_time: '19:30',
  venue_name: 'Cinema Paradiso',
  location: null,
  status: 'active',
  image_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80',
  match_percentage: 85,
  attendee_count: 23,
  attendees: mockAttendees,
  created_by: 'user-1',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: 'scraper-cinema-paradiso',
  event_fingerprint: 'fp-moonlight-stories',
  max_attendees: 50,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Discovery Event without Image - Glassmorphism with gradient fallback
export const discoveryEventNoImage: EventWithAttendees = {
  id: 'discovery-2',
  title: 'Open Mic Night at The Coffee House',
  description: 'Showcase your talent or enjoy performances from local artists. All skill levels welcome!',
  category: 'music',
  event_type: 'signal',
  event_date: addDays(3),
  event_time: '20:00',
  venue_name: 'The Coffee House',
  location: null,
  status: 'active',
  image_url: null,
  match_percentage: 78,
  attendee_count: 12,
  attendees: mockAttendees.slice(0, 2),
  created_by: 'user-2',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: null,
  event_fingerprint: null,
  max_attendees: 30,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Event with Long Description - Line clamp test
export const eventLongDescription: EventWithAttendees = {
  id: 'long-desc-1',
  title: 'Summer Music Festival 2026',
  description: 'Get ready for the biggest music event of the year! Summer Music Festival brings together world-class artists from across the globe for three days of non-stop entertainment. Experience multiple stages featuring rock, pop, electronic, and indie music. Food trucks from local vendors, art installations, and interactive experiences await. Early bird tickets available now. VIP packages include backstage access, premium viewing areas, and exclusive meet-and-greets with headlining artists. Don\'t miss this incredible celebration of music and community!',
  category: 'music',
  event_type: 'anchor',
  event_date: addDays(45),
  event_time: '12:00',
  venue_name: 'Central Park Amphitheater',
  location: null,
  status: 'active',
  image_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
  match_percentage: 92,
  attendee_count: 847,
  attendees: mockAttendees,
  created_by: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: 'scraper-ticketmaster',
  event_fingerprint: 'fp-summer-fest-2026',
  max_attendees: 5000,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Past Event - Dimmed styling
export const pastEvent: EventWithAttendees = {
  id: 'past-1',
  title: 'Basketball Championship Finals',
  description: 'The thrilling conclusion to this season',
  category: 'active',
  event_type: 'anchor',
  event_date: addDays(-2),
  event_time: '18:00',
  venue_name: 'Madison Square Garden',
  location: null,
  status: 'completed',
  image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
  match_percentage: 88,
  attendee_count: 15,
  attendees: mockAttendees,
  created_by: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: 'scraper-sports',
  event_fingerprint: 'fp-basketball-finals',
  max_attendees: null,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Gaming Event
export const gamingEvent: EventWithAttendees = {
  id: 'gaming-1',
  title: 'Super Smash Bros Ultimate Tournament',
  description: 'Competitive gaming tournament with prizes for top 3 finishers',
  category: 'gaming',
  event_type: 'signal',
  event_date: addDays(5),
  event_time: '15:00',
  venue_name: 'GameStop Arena',
  location: null,
  status: 'active',
  image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
  match_percentage: 95,
  attendee_count: 32,
  attendees: mockAttendees,
  created_by: 'user-3',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: null,
  event_fingerprint: null,
  max_attendees: 64,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Family Event
export const familyEvent: EventWithAttendees = {
  id: 'family-1',
  title: 'Kids Craft Workshop',
  description: 'Creative activities for children ages 5-12. Materials provided.',
  category: 'family',
  event_type: 'signal',
  event_date: addDays(1),
  event_time: '10:00',
  venue_name: 'Community Center',
  location: null,
  status: 'active',
  image_url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80',
  match_percentage: 80,
  attendee_count: 8,
  attendees: mockAttendees.slice(0, 1),
  created_by: 'user-1',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: null,
  event_fingerprint: null,
  max_attendees: 15,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Outdoor Event
export const outdoorEvent: EventWithAttendees = {
  id: 'outdoor-1',
  title: 'Morning Hiking Trail',
  description: 'Join us for a scenic 5-mile hike through beautiful mountain trails',
  category: 'outdoors',
  event_type: 'signal',
  event_date: addDays(4),
  event_time: '07:00',
  venue_name: 'Mountain Trail Head',
  location: null,
  status: 'active',
  image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  match_percentage: 82,
  attendee_count: 6,
  attendees: mockAttendees.slice(0, 2),
  created_by: 'user-2',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: null,
  event_fingerprint: null,
  max_attendees: 20,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Foodie Event
export const foodieEvent: EventWithAttendees = {
  id: 'foodie-1',
  title: 'Wine & Cheese Tasting Evening',
  description: 'Sample artisanal cheeses paired with local wines',
  category: 'foodie',
  event_type: 'anchor',
  event_date: addDays(6),
  event_time: '18:30',
  venue_name: 'The Wine Cellar',
  location: null,
  status: 'active',
  image_url: 'https://images.unsplash.com/photo-1510972527921-ce03766a1cf1?w=800&q=80',
  match_percentage: 87,
  attendee_count: 18,
  attendees: mockAttendees,
  created_by: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: 'scraper-wine-cellar',
  event_fingerprint: 'fp-wine-cheese',
  max_attendees: 25,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Workshop Event
export const workshopEvent: EventWithAttendees = {
  id: 'workshop-1',
  title: 'Introduction to Pottery',
  description: 'Learn the basics of pottery and create your own ceramic piece',
  category: 'workshops',
  event_type: 'signal',
  event_date: addDays(7),
  event_time: '14:00',
  venue_name: 'Artisan Studio',
  location: null,
  status: 'active',
  image_url: null,
  match_percentage: 75,
  attendee_count: 4,
  attendees: mockAttendees.slice(0, 1),
  created_by: 'user-3',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  source_id: null,
  event_fingerprint: null,
  max_attendees: 10,
  parent_event_id: null,
  parent_event: null,
  time_mode: 'fixed',
  opening_hours: null,
};

// Collection: Mixed Events (Calendar + Discovery)
export const mixedEvents: EventWithAttendees[] = [
  calendarEvent,
  discoveryEventWithImage,
  familyEvent,
  discoveryEventNoImage,
  gamingEvent,
  outdoorEvent,
  foodieEvent,
  workshopEvent,
];

// Collection: Calendar-only Events
export const calendarOnlyEvents: EventWithAttendees[] = [
  calendarEvent,
  {
    ...calendarEvent,
    id: 'cal-event-2',
    title: 'Project Kickoff Meeting',
    description: 'Initial planning session for Q2 projects',
    event_date: addDays(1),
    event_time: '09:00',
    venue_name: 'Conference Room A',
    attendee_count: 8,
  },
  {
    ...calendarEvent,
    id: 'cal-event-3',
    title: 'Client Presentation',
    description: 'Present quarterly results to stakeholders',
    event_date: addDays(3),
    event_time: '15:30',
    venue_name: 'Virtual / Google Meet',
    attendee_count: 12,
  },
];

// Collection: Discovery-only Events
export const discoveryOnlyEvents: EventWithAttendees[] = [
  discoveryEventWithImage,
  discoveryEventNoImage,
  gamingEvent,
  outdoorEvent,
  foodieEvent,
  workshopEvent,
];

// Collection: Events with Images
export const eventsWithImages: EventWithAttendees[] = [
  discoveryEventWithImage,
  eventLongDescription,
  pastEvent,
  gamingEvent,
  familyEvent,
  outdoorEvent,
  foodieEvent,
];

// Collection: Events without Images
export const eventsWithoutImages: EventWithAttendees[] = [
  calendarEvent,
  discoveryEventNoImage,
  workshopEvent,
];

// Collection: Edge Cases
export const edgeCaseEvents: EventWithAttendees[] = [
  eventLongDescription,
  {
    ...calendarEvent,
    id: 'edge-1',
    title: 'Very Long Event Title That Should Be Truncated When Displayed In The Card Component',
    description: '',
    venue_name: 'Very Long Venue Name That Should Also Be Truncated When Displayed',
    attendee_count: 0,
    attendees: [],
  },
  {
    ...discoveryEventNoImage,
    id: 'edge-2',
    title: 'Event with Max Capacity',
    attendee_count: 50,
    max_attendees: 50,
  },
];

// Collection: Events Grouped by Date (for Timeline)
export const timelineGroupedEvents: EventWithAttendees[] = [
  // Today
  {
    ...calendarEvent,
    id: 'timeline-1',
    event_date: addHours(2),
    event_time: '14:00',
  },
  {
    ...discoveryEventWithImage,
    id: 'timeline-2',
    event_date: addHours(7),
    event_time: '19:00',
  },
  
  // Tomorrow
  {
    ...familyEvent,
    id: 'timeline-3',
    event_date: addDays(1),
  },
  {
    ...gamingEvent,
    id: 'timeline-4',
    event_date: addDays(1),
    event_time: '18:00',
  },
  
  // Day after tomorrow
  {
    ...outdoorEvent,
    id: 'timeline-5',
    event_date: addDays(2),
  },
  {
    ...discoveryEventNoImage,
    id: 'timeline-6',
    event_date: addDays(2),
    event_time: '20:00',
  },
  
  // Future dates
  {
    ...foodieEvent,
    id: 'timeline-7',
    event_date: addDays(3),
  },
  {
    ...workshopEvent,
    id: 'timeline-8',
    event_date: addDays(5),
  },
];
