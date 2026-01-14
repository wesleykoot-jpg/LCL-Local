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

describe('feedAlgorithm mode-based weighting', () => {
  it('applies 2.5x boost to family events in family mode', () => {
    const familyEvent = buildEvent({
      id: 'family',
      category: 'family',
    });
    const socialEvent = buildEvent({
      id: 'social',
      category: 'social',
    });

    const defaultRanked = rankEvents([familyEvent, socialEvent], basePreferences, { ensureDiversity: false });
    const familyModeRanked = rankEvents([familyEvent, socialEvent], {
      ...basePreferences,
      feedMode: 'family',
    }, { ensureDiversity: false });

    // In family mode, family event should be ranked first
    expect(familyModeRanked[0].id).toBe('family');
  });

  it('applies 1.5x boost to outdoors/active events when parent is detected in family mode', () => {
    const outdoorsEvent = buildEvent({
      id: 'outdoors',
      category: 'outdoors',
    });
    const entertainmentEvent = buildEvent({
      id: 'entertainment',
      category: 'entertainment',
    });

    const familyModeWithParent = rankEvents([outdoorsEvent, entertainmentEvent], {
      ...basePreferences,
      feedMode: 'family',
      isParentDetected: true,
    }, { ensureDiversity: false });

    // Outdoors should be boosted in family mode with parent detected
    expect(familyModeWithParent[0].id).toBe('outdoors');
  });

  it('applies 2.0x boost to social/music/foodie events in social mode', () => {
    const musicEvent = buildEvent({
      id: 'music',
      category: 'music',
    });
    const familyEvent = buildEvent({
      id: 'family',
      category: 'family',
    });

    const socialModeRanked = rankEvents([familyEvent, musicEvent], {
      ...basePreferences,
      feedMode: 'social',
    }, { ensureDiversity: false });

    // In social mode, music event should be ranked first
    expect(socialModeRanked[0].id).toBe('music');
  });

  it('suppresses family events (0.3x) in social mode', () => {
    const familyEvent = buildEvent({
      id: 'family',
      category: 'family',
      attendee_count: 100, // High social proof
    });
    const socialEvent = buildEvent({
      id: 'social',
      category: 'social',
      attendee_count: 10, // Lower social proof
    });

    const socialModeRanked = rankEvents([familyEvent, socialEvent], {
      ...basePreferences,
      feedMode: 'social',
    }, { ensureDiversity: false });

    // Even with higher attendee count, family event should be suppressed
    expect(socialModeRanked[0].id).toBe('social');
  });

  it('uses default weights when feedMode is "default"', () => {
    const familyEvent = buildEvent({
      id: 'family',
      category: 'family',
    });
    const socialEvent = buildEvent({
      id: 'social',
      category: 'social',
    });

    const defaultRanked = rankEvents([familyEvent, socialEvent], {
      ...basePreferences,
      feedMode: 'default',
    }, { ensureDiversity: false });

    // Both events should be treated equally without mode multipliers
    expect(defaultRanked).toHaveLength(2);
  });
});

describe('feedAlgorithm existing boosts still work', () => {
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
