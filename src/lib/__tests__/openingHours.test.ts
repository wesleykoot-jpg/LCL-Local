import { describe, it, expect } from 'vitest';
import {
  isOpenNow,
  getClosingTimeToday,
  getNextOpeningTime,
  formatOpeningHours,
  type OpeningHours,
} from '../openingHours';

describe('Opening Hours Utilities', () => {
  const sampleHours: OpeningHours = {
    monday: ['09:00-17:00'],
    tuesday: ['09:00-17:00'],
    wednesday: ['09:00-17:00'],
    thursday: ['09:00-17:00'],
    friday: ['09:00-12:00', '13:00-22:00'],
    saturday: ['10:00-14:00'],
  };

  describe('isOpenNow', () => {
    it('should return true when venue is open', () => {
      // Test Monday 10:00 AM
      const mondayMorning = new Date('2024-01-08T10:00:00'); // Monday
      expect(isOpenNow(sampleHours, mondayMorning)).toBe(true);
    });

    it('should return false when venue is closed', () => {
      // Test Monday 6:00 PM (17:00)
      const mondayEvening = new Date('2024-01-08T18:00:00'); // Monday
      expect(isOpenNow(sampleHours, mondayEvening)).toBe(false);
    });

    it('should return false when no hours provided', () => {
      const mondayMorning = new Date('2024-01-08T10:00:00');
      expect(isOpenNow(null, mondayMorning)).toBe(false);
    });

    it('should return false on Sunday when no hours set', () => {
      // Sunday with no hours defined
      const sunday = new Date('2024-01-07T10:00:00'); // Sunday
      expect(isOpenNow(sampleHours, sunday)).toBe(false);
    });

    it('should handle split shifts', () => {
      // Friday afternoon break (12:00-13:00)
      const fridayBreak = new Date('2024-01-12T12:30:00'); // Friday
      expect(isOpenNow(sampleHours, fridayBreak)).toBe(false);

      // Friday evening (after 13:00)
      const fridayEvening = new Date('2024-01-12T20:00:00'); // Friday
      expect(isOpenNow(sampleHours, fridayEvening)).toBe(true);
    });
  });

  describe('getClosingTimeToday', () => {
    it('should return closing time when open', () => {
      const mondayMorning = new Date('2024-01-08T10:00:00'); // Monday
      expect(getClosingTimeToday(sampleHours, mondayMorning)).toBe('17:00');
    });

    it('should return null when closed', () => {
      const mondayEvening = new Date('2024-01-08T18:00:00'); // Monday
      expect(getClosingTimeToday(sampleHours, mondayEvening)).toBe(null);
    });

    it('should return null when no hours provided', () => {
      const mondayMorning = new Date('2024-01-08T10:00:00');
      expect(getClosingTimeToday(null, mondayMorning)).toBe(null);
    });
  });

  describe('getNextOpeningTime', () => {
    it('should return next opening time', () => {
      const sunday = new Date('2024-01-07T10:00:00'); // Sunday (closed)
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

    it('should handle empty opening hours', () => {
      expect(formatOpeningHours({})).toBe('Hours not available');
    });
  });
});
