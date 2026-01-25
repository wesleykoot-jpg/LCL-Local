import { describe, expect, it } from 'vitest';
import {
  hasRitualKeywords,
  getEventDayOfWeek,
  filterRitualEvents,
  areSimilarTitles,
  areSameVenue,
} from '../ritualDetection';
import type { EventWithAttendees } from '../../hooks/hooks';

// Helper to create mock events
const createMockEvent = (overrides: Partial<EventWithAttendees> = {}): EventWithAttendees => ({
  id: `event-${Math.random().toString(36).slice(2)}`,
  title: 'Test Event',
  description: null,
  category: 'social',
  event_date: new Date().toISOString().split('T')[0],
  event_time: '18:00',
  venue_name: 'Test Venue',
  address: null,
  location: null,
  image_url: null,
  event_type: 'signal',
  parent_event_id: null,
  source_url: null,
  external_id: null,
  created_at: new Date().toISOString(),
  created_by: null,
  max_attendees: null,
  is_published: true,
  tags: null,
  structured_date: null,
  structured_location: null,
  original_organizer: null,
  attendee_count: 0,
  attendees: [],
  ...overrides,
});

describe('Ritual Detection', () => {
  describe('hasRitualKeywords', () => {
    it('should detect weekly keyword in title', () => {
      const event = createMockEvent({ title: 'Weekly Jazz Night' });
      expect(hasRitualKeywords(event)).toBe(true);
    });

    it('should detect monthly keyword in title', () => {
      const event = createMockEvent({ title: 'Monthly Book Club' });
      expect(hasRitualKeywords(event)).toBe(true);
    });

    it('should detect Dutch keywords', () => {
      const event = createMockEvent({ title: 'Vrijdagborrel' });
      expect(hasRitualKeywords(event)).toBe(true);
    });

    it('should detect keywords in description', () => {
      const event = createMockEvent({ 
        title: 'Jazz Night',
        description: 'This is a weekly event every Friday'
      });
      expect(hasRitualKeywords(event)).toBe(true);
    });

    it('should return false for one-time events', () => {
      const event = createMockEvent({ title: 'One-time Concert' });
      expect(hasRitualKeywords(event)).toBe(false);
    });

    it('should detect meetup keyword', () => {
      const event = createMockEvent({ title: 'Developer Meetup' });
      expect(hasRitualKeywords(event)).toBe(true);
    });

    it('should detect class keyword', () => {
      const event = createMockEvent({ title: 'Yoga Class' });
      expect(hasRitualKeywords(event)).toBe(true);
    });
  });

  describe('getEventDayOfWeek', () => {
    it('should return day name for valid date', () => {
      const monday = '2024-01-01'; // This was a Monday
      expect(getEventDayOfWeek(monday)).toBe('Monday');
    });

    it('should return null for null date', () => {
      expect(getEventDayOfWeek(null)).toBeNull();
    });

    it('should handle various date formats', () => {
      const date = '2024-03-15'; // Friday
      expect(getEventDayOfWeek(date)).toBe('Friday');
    });
  });

  describe('areSimilarTitles', () => {
    it('should match exact titles', () => {
      expect(areSimilarTitles('Jazz Night', 'Jazz Night')).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(areSimilarTitles('Jazz Night', 'jazz night')).toBe(true);
    });

    it('should match titles with number suffixes', () => {
      expect(areSimilarTitles('Jazz Night', 'Jazz Night #12')).toBe(true);
      expect(areSimilarTitles('Jazz Night', 'Jazz Night - 5')).toBe(true);
    });

    it('should not match completely different titles', () => {
      expect(areSimilarTitles('Jazz Night', 'Rock Concert')).toBe(false);
    });

    it('should match when one contains the other', () => {
      expect(areSimilarTitles('Jazz Session', 'Weekly Jazz Session')).toBe(true);
    });
  });

  describe('areSameVenue', () => {
    it('should match same venue names', () => {
      const event1 = createMockEvent({ venue_name: 'The Jazz Club' });
      const event2 = createMockEvent({ venue_name: 'The Jazz Club' });
      expect(areSameVenue(event1, event2)).toBe(true);
    });

    it('should match case-insensitively', () => {
      const event1 = createMockEvent({ venue_name: 'The Jazz Club' });
      const event2 = createMockEvent({ venue_name: 'the jazz club' });
      expect(areSameVenue(event1, event2)).toBe(true);
    });

    it('should return false for different venues', () => {
      const event1 = createMockEvent({ venue_name: 'The Jazz Club' });
      const event2 = createMockEvent({ venue_name: 'Rock Arena' });
      expect(areSameVenue(event1, event2)).toBe(false);
    });

    it('should return false when venues are null', () => {
      const event1 = createMockEvent({ venue_name: null });
      const event2 = createMockEvent({ venue_name: 'Rock Arena' });
      expect(areSameVenue(event1, event2)).toBe(false);
    });
  });

  describe('filterRitualEvents', () => {
    it('should filter events with ritual keywords', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const events = [
        createMockEvent({ 
          title: 'Weekly Jazz Night',
          event_date: futureDate.toISOString().split('T')[0]
        }),
        createMockEvent({ 
          title: 'One-time Concert',
          event_date: futureDate.toISOString().split('T')[0]
        }),
        createMockEvent({ 
          title: 'Monthly Meetup',
          event_date: futureDate.toISOString().split('T')[0]
        }),
      ];

      const rituals = filterRitualEvents(events);
      
      expect(rituals.length).toBe(2);
      expect(rituals.some(e => e.title === 'Weekly Jazz Night')).toBe(true);
      expect(rituals.some(e => e.title === 'Monthly Meetup')).toBe(true);
      expect(rituals.some(e => e.title === 'One-time Concert')).toBe(false);
    });

    it('should return empty array when no rituals found', () => {
      const events = [
        createMockEvent({ title: 'Concert' }),
        createMockEvent({ title: 'Festival' }),
      ];

      const rituals = filterRitualEvents(events);
      expect(rituals.length).toBe(0);
    });
  });
});
