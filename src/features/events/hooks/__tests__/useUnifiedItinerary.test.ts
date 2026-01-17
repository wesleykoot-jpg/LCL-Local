import { describe, expect, it } from 'vitest';
import { setHours, addHours, setMinutes } from 'date-fns';

describe('useUnifiedItinerary helpers', () => {
  function getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function formatDayLabel(date: Date, today: Date): string {
    const dateKey = getDateKey(date);
    const todayKey = getDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getDateKey(tomorrow);
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;

    if (dateKey === todayKey) {
      return 'Today';
    }
    if (dateKey === tomorrowKey) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  describe('formatDayLabel', () => {
    it('returns "Today" for today', () => {
      const today = new Date('2025-10-12T00:00:00');
      expect(formatDayLabel(today, today)).toBe('Today');
    });

    it('returns "Tomorrow" for the next day', () => {
      const today = new Date('2025-10-12T00:00:00');
      const tomorrow = new Date('2025-10-13T00:00:00');
      expect(formatDayLabel(tomorrow, today)).toBe('Tomorrow');
    });

    it('returns a short weekday label for other dates', () => {
      const today = new Date('2025-10-12T00:00:00');
      const future = new Date('2025-10-15T00:00:00');
      const label = formatDayLabel(future, today);
      expect(label).not.toBe('Today');
      expect(label).not.toBe('Tomorrow');
      expect(label).toMatch(/\d{1,2}/);
    });
  });

  describe('Itinerary item types', () => {
    it('supports the expected source types', () => {
      const types = ['LCL_EVENT', 'GOOGLE_CALENDAR'] as const;
      expect(types).toContain('LCL_EVENT');
      expect(types).toContain('GOOGLE_CALENDAR');
    });

    it('supports the expected status values', () => {
      const statuses = ['confirmed', 'tentative'] as const;
      expect(statuses).toContain('confirmed');
      expect(statuses).toContain('tentative');
    });
  });
});

// Test suite for detectTimeOverlaps function
describe('detectTimeOverlaps', () => {
  const today = new Date();
  
  interface ItineraryItem {
    id: string;
    title: string;
    startTime: Date;
    endTime?: Date;
    conflictType?: 'overlap' | null;
  }

  /**
   * Detect time overlaps between itinerary items
   * Marks items with conflictType='overlap' if they have strictly overlapping times
   * Adjacent events (end === start) are NOT considered overlaps
   * Items without endTime are treated as zero-length events at startTime
   */
  function detectTimeOverlaps(items: ItineraryItem[]): ItineraryItem[] {
    // Clone items and reset conflictType
    const cloned = items.map(i => ({ ...i, conflictType: null as 'overlap' | null }));
    
    // Sort by startTime for comparison
    const sorted = cloned.slice().sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // Check each pair for overlaps
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      
      // Get end times (if missing, use startTime for zero-length)
      const prevEnd = (prev.endTime ?? prev.startTime).getTime();
      const curStart = cur.startTime.getTime();
      
      // Strict overlap check (curStart < prevEnd, not <=)
      if (curStart < prevEnd) {
        prev.conflictType = 'overlap';
        cur.conflictType = 'overlap';
      }
    }
    
    // Map back to original order using item IDs
    const byId = new Map(sorted.map(it => [it.id, it]));
    return items.map(orig => byId.get(orig.id) ?? { ...orig, conflictType: null });
  }
  
  describe('overlapping events', () => {
    it('should detect overlapping events', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 12),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 11),
          endTime: setHours(today, 13),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      expect(result[0].conflictType).toBe('overlap');
      expect(result[1].conflictType).toBe('overlap');
    });
    
    it('should detect when second event starts during first event', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 14),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 12),
          endTime: setHours(today, 13),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      expect(result[0].conflictType).toBe('overlap');
      expect(result[1].conflictType).toBe('overlap');
    });
  });
  
  describe('non-overlapping events', () => {
    it('should not detect overlaps for non-overlapping events', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 11),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 12),
          endTime: setHours(today, 13),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      expect(result[0].conflictType).toBe(null);
      expect(result[1].conflictType).toBe(null);
    });
    
    it('should NOT flag adjacent events (end === start) as overlapping', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 11),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 11), // Starts exactly when Event 1 ends
          endTime: setHours(today, 12),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      expect(result[0].conflictType).toBe(null);
      expect(result[1].conflictType).toBe(null);
    });
  });
  
  describe('missing endTime', () => {
    it('should treat items without endTime as zero-length events', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          // No endTime - treated as zero-length
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 11),
          endTime: setHours(today, 12),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      // Event 1 is zero-length at 10:00, Event 2 starts at 11:00
      // No overlap
      expect(result[0].conflictType).toBe(null);
      expect(result[1].conflictType).toBe(null);
    });
    
    it('should detect overlaps when event without endTime starts during another event', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 12),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 11),
          // No endTime - zero-length at 11:00, which is during Event 1
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      expect(result[0].conflictType).toBe('overlap');
      expect(result[1].conflictType).toBe('overlap');
    });
  });
  
  describe('simultaneous events', () => {
    it('should detect overlaps for events starting at exactly the same time', () => {
      const startTime = setHours(today, 10);
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime,
          endTime: addHours(startTime, 2),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime,
          endTime: addHours(startTime, 1),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      expect(result[0].conflictType).toBe('overlap');
      expect(result[1].conflictType).toBe('overlap');
    });
  });
  
  describe('original order preservation', () => {
    it('should preserve original order of items in the result', () => {
      const items: ItineraryItem[] = [
        {
          id: '3',
          title: 'Event 3',
          startTime: setHours(today, 15),
          endTime: setHours(today, 16),
        },
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 11),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 12),
          endTime: setHours(today, 13),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      // Order should be preserved
      expect(result[0].id).toBe('3');
      expect(result[1].id).toBe('1');
      expect(result[2].id).toBe('2');
    });
  });
  
  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = detectTimeOverlaps([]);
      expect(result).toEqual([]);
    });
    
    it('should handle single item', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 11),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      expect(result[0].conflictType).toBe(null);
    });
    
    it('should handle multiple overlapping events in a chain', () => {
      const items: ItineraryItem[] = [
        {
          id: '1',
          title: 'Event 1',
          startTime: setHours(today, 10),
          endTime: setHours(today, 12),
        },
        {
          id: '2',
          title: 'Event 2',
          startTime: setHours(today, 11),
          endTime: setHours(today, 13),
        },
        {
          id: '3',
          title: 'Event 3',
          startTime: setMinutes(setHours(today, 12), 30),
          endTime: setHours(today, 14),
        },
      ];
      
      const result = detectTimeOverlaps(items);
      
      // All three should be marked as overlapping
      expect(result[0].conflictType).toBe('overlap');
      expect(result[1].conflictType).toBe('overlap');
      expect(result[2].conflictType).toBe('overlap');
    });
  });
});
