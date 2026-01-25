import { describe, expect, it } from 'vitest';
import {
  railRegistry,
  ForYouRailProvider,
  RitualsRailProvider,
  ThisWeekendRailProvider,
  LocationRailProvider,
  PulseRailProvider,
} from '../RailProviderRegistry';
import type { RailContext } from '../types';
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

const createDefaultContext = (): RailContext => ({
  selectedCategories: [],
  locationCity: 'Amsterdam',
  country: 'Netherlands',
  userLocation: { lat: 52.3676, lng: 4.9041 },
  radiusKm: 25,
});

describe('RailProviderRegistry', () => {
  describe('Registry', () => {
    it('should register all 5 default providers', () => {
      const providers = railRegistry.getAllSorted();
      expect(providers).toHaveLength(5);
    });

    it('should return providers sorted by priority', () => {
      const providers = railRegistry.getAllSorted();
      const types = providers.map(p => p.type);
      expect(types).toEqual(['for-you', 'rituals', 'this-weekend', 'location', 'pulse']);
    });

    it('should get a specific provider by type', () => {
      const provider = railRegistry.get('for-you');
      expect(provider).toBeInstanceOf(ForYouRailProvider);
    });
  });

  describe('ForYouRailProvider', () => {
    const provider = new ForYouRailProvider();

    it('should have correct type and priority', () => {
      expect(provider.type).toBe('for-you');
      expect(provider.getMetadata(createDefaultContext()).priority).toBe(1);
    });

    it('should filter events by selected categories', () => {
      const events = [
        createMockEvent({ category: 'music' }),
        createMockEvent({ category: 'sports' }),
        createMockEvent({ category: 'music' }),
      ];
      const context = { ...createDefaultContext(), selectedCategories: ['music'] };
      
      const filtered = provider.filterEvents(events, context);
      expect(filtered.every(e => e.category === 'music')).toBe(true);
    });

    it('should include all events when no categories selected', () => {
      const events = [
        createMockEvent({ category: 'music' }),
        createMockEvent({ category: 'sports' }),
      ];
      const context = createDefaultContext();
      
      const filtered = provider.filterEvents(events, context);
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('RitualsRailProvider', () => {
    const provider = new RitualsRailProvider();

    it('should have correct type and priority', () => {
      expect(provider.type).toBe('rituals');
      expect(provider.getMetadata(createDefaultContext()).priority).toBe(2);
    });

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
      
      const filtered = provider.filterEvents(events, createDefaultContext());
      expect(filtered.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ThisWeekendRailProvider', () => {
    const provider = new ThisWeekendRailProvider();

    it('should have correct type and priority', () => {
      expect(provider.type).toBe('this-weekend');
      expect(provider.getMetadata(createDefaultContext()).priority).toBe(3);
    });

    it('should filter events happening this weekend', () => {
      // Calculate next Saturday
      const now = new Date();
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + daysUntilSaturday);
      
      const events = [
        createMockEvent({ 
          event_date: saturday.toISOString().split('T')[0],
          title: 'Weekend Event'
        }),
        createMockEvent({ 
          event_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          title: 'Next Week Event'
        }),
      ];
      
      const filtered = provider.filterEvents(events, createDefaultContext());
      // Should include weekend events but not events far in the future
      const hasWeekendEvent = filtered.some(e => e.title === 'Weekend Event');
      const hasNextWeekEvent = filtered.some(e => e.title === 'Next Week Event');
      
      expect(hasWeekendEvent || filtered.length === 0).toBe(true); // Depends on current day
      expect(hasNextWeekEvent).toBe(false);
    });
  });

  describe('LocationRailProvider', () => {
    const provider = new LocationRailProvider();

    it('should have correct type and priority', () => {
      expect(provider.type).toBe('location');
      expect(provider.getMetadata(createDefaultContext()).priority).toBe(4);
    });

    it('should filter nearby events', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const events = [
        createMockEvent({ 
          distance_km: 2, 
          title: 'Nearby Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
        createMockEvent({ 
          distance_km: 50, 
          title: 'Far Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
      ];
      
      const filtered = provider.filterEvents(events, { ...createDefaultContext(), radiusKm: 25 });
      // Nearby events (within half radius = 12.5km) should be included
      expect(filtered.some(e => e.title === 'Nearby Event')).toBe(true);
    });
  });

  describe('PulseRailProvider', () => {
    const provider = new PulseRailProvider();

    it('should have correct type and priority', () => {
      expect(provider.type).toBe('pulse');
      expect(provider.getMetadata(createDefaultContext()).priority).toBe(5);
    });

    it('should filter trending events with high attendance', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const events = [
        createMockEvent({ 
          attendee_count: 100, 
          title: 'Popular Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
        createMockEvent({ 
          attendee_count: 5, 
          title: 'Small Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
      ];
      
      const filtered = provider.filterEvents(events, createDefaultContext());
      expect(filtered.some(e => e.title === 'Popular Event')).toBe(true);
      expect(filtered.some(e => e.title === 'Small Event')).toBe(false);
    });

    it('should sort events by attendee count', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const events = [
        createMockEvent({ 
          attendee_count: 50, 
          title: 'Medium Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
        createMockEvent({ 
          attendee_count: 200, 
          title: 'Big Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
        createMockEvent({ 
          attendee_count: 20, 
          title: 'Small Trending Event',
          event_date: futureDate.toISOString().split('T')[0]
        }),
      ];
      
      const filtered = provider.filterEvents(events, createDefaultContext());
      expect(filtered[0].title).toBe('Big Event');
    });
  });

  describe('generateRails', () => {
    it('should generate rails for given events and context', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const events = [
        createMockEvent({ 
          category: 'music', 
          title: 'Weekly Jazz',
          event_date: futureDate.toISOString().split('T')[0],
          attendee_count: 15
        }),
        createMockEvent({ 
          category: 'sports', 
          distance_km: 1,
          event_date: futureDate.toISOString().split('T')[0],
          attendee_count: 50
        }),
      ];
      
      const context = createDefaultContext();
      const rails = railRegistry.generateRails(events, context);
      
      expect(rails.length).toBeGreaterThan(0);
      expect(rails.every(r => r.shouldShow)).toBe(true);
    });

    it('should filter out empty rails', () => {
      const events: EventWithAttendees[] = [];
      const context = createDefaultContext();
      
      const rails = railRegistry.generateRails(events, context);
      expect(rails.length).toBe(0);
    });
  });
});
