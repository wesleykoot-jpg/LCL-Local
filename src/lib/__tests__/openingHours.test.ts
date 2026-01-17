import { describe, it, expect } from 'vitest';
import {
  isOpenNow,
  getClosingTimeToday,
  getNextOpeningTime,
  formatOpeningHours,
  transformGoogleHoursToSchema,
  validateOpeningHours,
  type OpeningHours,
} from '../openingHours';

describe('Opening Hours Utilities', () => {
  const sampleHours: OpeningHours = {
    monday: [{ open: '09:00', close: '17:00' }],
    tuesday: [{ open: '09:00', close: '17:00' }],
    wednesday: [{ open: '09:00', close: '17:00' }],
    thursday: [{ open: '09:00', close: '17:00' }],
    friday: [
      { open: '12:00', close: '14:00' },
      { open: '18:00', close: '22:00' },
    ],
    saturday: 'closed',
    sunday: 'closed',
  };

  describe('isOpenNow', () => {
    it('should return true when venue is open', () => {
      const mondayMorning = new Date('2024-01-08T10:00:00'); // Monday
      expect(isOpenNow(sampleHours, mondayMorning)).toBe(true);
    });

    it('should return false when venue is closed', () => {
      const mondayEvening = new Date('2024-01-08T18:00:00'); // Monday
      expect(isOpenNow(sampleHours, mondayEvening)).toBe(false);
    });

    it('should return false when no hours provided', () => {
      const mondayMorning = new Date('2024-01-08T10:00:00');
      expect(isOpenNow(null, mondayMorning)).toBe(false);
    });

    it('should return false on Sunday when closed', () => {
      const sunday = new Date('2024-01-07T10:00:00'); // Sunday
      expect(isOpenNow(sampleHours, sunday)).toBe(false);
    });

    it('should handle split shifts', () => {
      const fridayBreak = new Date('2024-01-12T12:30:00'); // Friday
      expect(isOpenNow(sampleHours, fridayBreak)).toBe(false);

      const fridayEvening = new Date('2024-01-12T20:00:00'); // Friday
      expect(isOpenNow(sampleHours, fridayEvening)).toBe(true);
    });

    it('should handle overnight ranges', () => {
      const overnightHours: OpeningHours = {
        friday: [{ open: '23:00', close: '02:00', closes_next_day: true }],
        saturday: 'closed',
      };

      const fridayLate = new Date('2024-01-12T23:30:00');
      expect(isOpenNow(overnightHours, fridayLate)).toBe(true);

      const saturdayEarly = new Date('2024-01-13T01:00:00');
      expect(isOpenNow(overnightHours, saturdayEarly)).toBe(true);

      const saturdayAfterClose = new Date('2024-01-13T03:00:00');
      expect(isOpenNow(overnightHours, saturdayAfterClose)).toBe(false);
    });

    it('should honor always open flag', () => {
      const alwaysOpen: OpeningHours = { always_open: true };
      const anyTime = new Date('2024-01-07T03:00:00');
      expect(isOpenNow(alwaysOpen, anyTime)).toBe(true);
    });
  });

  describe('getClosingTimeToday', () => {
    it('should return closing time when open', () => {
      const mondayMorning = new Date('2024-01-08T10:00:00');
      expect(getClosingTimeToday(sampleHours, mondayMorning)).toBe('17:00');
    });

    it('should return null when closed', () => {
      const mondayEvening = new Date('2024-01-08T18:00:00');
      expect(getClosingTimeToday(sampleHours, mondayEvening)).toBe(null);
    });

    it('should return closing time for overnight ranges', () => {
      const overnightHours: OpeningHours = {
        friday: [{ open: '23:00', close: '02:00', closes_next_day: true }],
        saturday: 'closed',
      };

      const saturdayEarly = new Date('2024-01-13T01:00:00');
      expect(getClosingTimeToday(overnightHours, saturdayEarly)).toBe('02:00');
    });
  });

  describe('getNextOpeningTime', () => {
    it('should return next opening time', () => {
      const sunday = new Date('2024-01-07T10:00:00');
      const nextOpening = getNextOpeningTime(sampleHours, sunday);

      expect(nextOpening).toBeDefined();
      expect(nextOpening?.day).toBe('Monday');
      expect(nextOpening?.time).toBe('09:00');
    });

    it('should return null when no hours provided', () => {
      const sunday = new Date('2024-01-07T10:00:00');
      expect(getNextOpeningTime(null, sunday)).toBe(null);
    });

    it('should return null when no opening hours in next 7 days', () => {
      const emptyHours: OpeningHours = {};
      const sunday = new Date('2024-01-07T10:00:00');
      expect(getNextOpeningTime(emptyHours, sunday)).toBe(null);
    });
  });

  describe('formatOpeningHours', () => {
    it('should format opening hours correctly', () => {
      const formatted = formatOpeningHours(sampleHours);
      expect(formatted).toContain('Mon');
      expect(formatted).toContain('09:00-17:00');
    });

    it('should handle null opening hours', () => {
      expect(formatOpeningHours(null)).toBe('Hours not available');
    });

    it('should handle always open venues', () => {
      expect(formatOpeningHours({ always_open: true })).toBe('Open 24/7');
    });
  });

  describe('transformGoogleHoursToSchema', () => {
    it('should transform Google periods and mark closed days', () => {
      const transformed = transformGoogleHoursToSchema({
        periods: [
          { open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } },
          { open: { day: 5, time: '2300' }, close: { day: 6, time: '0200' } },
        ],
      });

      expect(transformed.monday).toEqual([{ open: '09:00', close: '17:00' }]);
      expect(transformed.friday).toEqual([
        { open: '23:00', close: '02:00', closes_next_day: true },
      ]);
      expect(transformed.sunday).toBe('closed');
    });

    it('should return always_open when no periods', () => {
      expect(transformGoogleHoursToSchema({})).toEqual({ always_open: true });
    });
  });

  describe('validateOpeningHours', () => {
    it('should validate non-overlapping ranges', () => {
      const validHours: OpeningHours = {
        monday: [
          { open: '09:00', close: '12:00' },
          { open: '13:00', close: '17:00' },
        ],
      };
      expect(validateOpeningHours(validHours)).toBe(true);
    });

    it('should reject overlapping ranges', () => {
      const invalidHours: OpeningHours = {
        monday: [
          { open: '09:00', close: '12:00' },
          { open: '11:00', close: '13:00' },
        ],
      };
      expect(validateOpeningHours(invalidHours)).toBe(false);
    });
  });
});
