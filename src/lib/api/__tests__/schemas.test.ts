import { describe, expect, it } from 'vitest';
import { parseEventsWithAttendees, parsePersonalizedFeedRows } from '@/lib/api/schemas';

describe('api schemas', () => {
  it('parses personalized feed rows', () => {
    const rows = [
      {
        event_id: 'event-1',
        title: 'Sample Event',
        description: 'Test description',
        category: 'music',
        event_type: 'anchor',
        parent_event_id: null,
        venue_name: 'Test Venue',
        location: null,
        event_date: '2026-01-16',
        event_time: '19:00:00',
        status: 'active',
        image_url: null,
        match_percentage: 0.8,
        attendee_count: 12,
        host_reliability: 0.9,
        distance_km: 3.2,
        final_score: 0.95,
      },
    ];

    const result = parsePersonalizedFeedRows(rows);

    expect(result).toHaveLength(1);
    expect(result[0].event_id).toBe('event-1');
  });

  it('falls back when personalized feed rows are invalid', () => {
    const result = parsePersonalizedFeedRows([{ title: 'Missing fields' }]);

    expect(result).toEqual([]);
  });

  it('falls back when events are invalid', () => {
    const result = parseEventsWithAttendees([{ id: 123 }]);

    expect(result).toEqual([]);
  });
});
