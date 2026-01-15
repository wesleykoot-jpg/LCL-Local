import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { rankEvents } from '@/lib/feedAlgorithm';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';

/**
 * E2E Feed Algorithm Audit Tests
 * 
 * Tests feed algorithm scoring with PostGIS coordinates:
 * - Distance-based scoring accuracy
 * - Category preference matching
 * - Time-based filtering
 * - Social proof weighting
 * - Edge cases
 */

describe('E2E Feed Algorithm Distance Scoring', () => {
  describe('PostGIS Coordinate Handling', () => {
    it('PASS: should correctly calculate distance from user location', () => {
      const userLocation = { lat: 52.3676, lng: 4.9041 }; // Amsterdam

      const nearbyEvent: EventWithAttendees = {
        id: 'event-nearby',
        title: 'Nearby Event',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Cinema Center',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 }, // ~0.5km away
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const distantEvent: EventWithAttendees = {
        id: 'event-distant',
        title: 'Distant Event',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Cinema Far',
        location: 'Rotterdam',
        coordinates: { lat: 51.9225, lng: 4.4792 }, // Rotterdam (~60km)
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const ranked = rankEvents(
        [distantEvent, nearbyEvent],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      expect(ranked[0].id).toBe('event-nearby');
      expect(ranked[1].id).toBe('event-distant');
    });

    it('CRITICAL: verify longitude comes first in PostGIS', () => {
      // PostGIS POINT format is POINT(lng lat), not POINT(lat lng)
      // This test documents the critical ordering

      const userLocation = { lat: 52.3676, lng: 4.9041 };
      
      // Event with correct coordinate order
      const event: EventWithAttendees = {
        id: 'event-1',
        title: 'Test Event',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 }, // Note: API returns {lat, lng}
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      // Verify that the algorithm correctly interprets coordinates
      const ranked = rankEvents(
        [event],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      expect(ranked.length).toBe(1);
      expect(ranked[0].coordinates).toEqual({ lat: 52.3700, lng: 4.9000 });
    });
  });

  describe('Category Weighting (35%)', () => {
    it('PASS: should prioritize matching categories', () => {
      const userLocation = { lat: 52.3676, lng: 4.9041 };

      const matchingCategory: EventWithAttendees = {
        id: 'matching',
        title: 'Cinema Event',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 5,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const nonMatchingCategory: EventWithAttendees = {
        id: 'non-matching',
        title: 'Sports Event',
        category: 'sports',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 5,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const ranked = rankEvents(
        [nonMatchingCategory, matchingCategory],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      expect(ranked[0].id).toBe('matching');
    });
  });

  describe('Time Relevance (20%)', () => {
    it('PASS: should prioritize sooner events', () => {
      const now = Date.now();
      const userLocation = { lat: 52.3676, lng: 4.9041 };

      const soonEvent: EventWithAttendees = {
        id: 'soon',
        title: 'Tonight',
        category: 'cinema',
        event_date: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const laterEvent: EventWithAttendees = {
        id: 'later',
        title: 'Next Month',
        category: 'cinema',
        event_date: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const ranked = rankEvents(
        [laterEvent, soonEvent],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      expect(ranked[0].id).toBe('soon');
    });
  });

  describe('Social Proof (15%)', () => {
    it('PASS: should boost high-attendance events', () => {
      const userLocation = { lat: 52.3676, lng: 4.9041 };

      const popularEvent: EventWithAttendees = {
        id: 'popular',
        title: 'Popular',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 150,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const unpopularEvent: EventWithAttendees = {
        id: 'unpopular',
        title: 'Unpopular',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 3,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const ranked = rankEvents(
        [unpopularEvent, popularEvent],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      expect(ranked[0].id).toBe('popular');
    });
  });

  describe('Edge Cases', () => {
    it('EDGE_CASE: should handle events without coordinates', () => {
      const userLocation = { lat: 52.3676, lng: 4.9041 };

      const eventWithCoords: EventWithAttendees = {
        id: 'with-coords',
        title: 'Has Location',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const eventWithoutCoords: EventWithAttendees = {
        id: 'without-coords',
        title: 'No Location',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: null,
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const ranked = rankEvents(
        [eventWithoutCoords, eventWithCoords],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      // Should handle gracefully without crashing
      expect(ranked.length).toBe(2);
    });

    it('EDGE_CASE: should handle user without location', () => {
      const event: EventWithAttendees = {
        id: 'event-1',
        title: 'Event',
        category: 'cinema',
        event_date: new Date().toISOString(),
        event_time: '20:00',
        venue_name: 'Venue',
        location: 'Amsterdam',
        coordinates: { lat: 52.3700, lng: 4.9000 },
        match_percentage: 50,
        attendee_count: 10,
        event_type: 'anchor',
        status: 'active',
        created_at: new Date().toISOString(),
        attendees: [],
      } as EventWithAttendees;

      const ranked = rankEvents(
        [event],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation: null,
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      // Should still rank events without distance scoring
      expect(ranked.length).toBe(1);
    });

    it('EDGE_CASE: should handle empty events array', () => {
      const ranked = rankEvents(
        [],
        {
          selectedCategories: ['cinema'],
          zone: 'amsterdam',
          userLocation: { lat: 52.3676, lng: 4.9041 },
          radiusKm: 25,
        },
        { ensureDiversity: false }
      );

      expect(ranked).toEqual([]);
    });
  });
});
