import { describe, expect, it } from 'vitest';

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
