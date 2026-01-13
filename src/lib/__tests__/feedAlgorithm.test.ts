import { describe, expect, it } from 'vitest';
import { rankEvents, type UserPreferences } from '../feedAlgorithm';

const basePreferences: UserPreferences = {
  selectedCategories: [],
  zone: 'test',
  userLocation: { lat: 0, lng: 0 },
  radiusKm: 25,
};

const buildEvent = (overrides: Partial<Parameters<typeof rankEvents>[0][number]>) => ({
  id: 'event',
  category: 'social',
  event_date: new Date().toISOString(),
  event_time: '20:00',
  match_percentage: 50,
  attendee_count: 0,
  venue_name: 'Test venue',
  coordinates: { lat: 0, lng: 0 },
  ...overrides,
});

describe('feedAlgorithm boosts', () => {
  it('prioritizes near-term events with urgency boost', () => {
    const now = Date.now();
    const soonEvent = buildEvent({
      id: 'soon',
      event_date: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
    });
    const laterEvent = buildEvent({
      id: 'later',
      event_date: new Date(now + 4 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const ranked = rankEvents([laterEvent, soonEvent], basePreferences, { ensureDiversity: false });
    expect(ranked[0].id).toBe('soon');
  });

  it('surfaces trending events with strong social proof', () => {
    const trending = buildEvent({
      id: 'trending',
      attendee_count: 120,
    });
    const quiet = buildEvent({
      id: 'quiet',
      attendee_count: 2,
    });

    const ranked = rankEvents([quiet, trending], basePreferences, { ensureDiversity: false });
    expect(ranked[0].id).toBe('trending');
  });
});
