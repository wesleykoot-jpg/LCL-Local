import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { formatRailTitle, formatStreakText, formatRitualDayLabel } from '../TitleFormatter';
import type { RailContext } from '../types';

const createDefaultContext = (): RailContext => ({
  selectedCategories: ['music', 'food'],
  locationCity: 'Amsterdam',
  country: 'Netherlands',
  userLocation: { lat: 52.3676, lng: 4.9041 },
  radiusKm: 25,
});

describe('TitleFormatter', () => {
  describe('formatRailTitle', () => {
    it('should generate For You title', () => {
      const result = formatRailTitle('for-you', createDefaultContext());
      expect(result.title).toBeTruthy();
      expect(result.description).toContain('music');
    });

    it('should generate For You description with categories', () => {
      const context = { ...createDefaultContext(), selectedCategories: ['jazz', 'blues'] };
      const result = formatRailTitle('for-you', context);
      expect(result.description).toContain('jazz');
    });

    it('should generate Rituals title', () => {
      const result = formatRailTitle('rituals', createDefaultContext());
      expect(result.title).toBeTruthy();
      expect(result.description).toBeTruthy();
    });

    it('should generate This Weekend title', () => {
      const result = formatRailTitle('this-weekend', createDefaultContext());
      expect(result.title.toLowerCase()).toContain('weekend');
    });

    it('should generate Location title with city name', () => {
      const result = formatRailTitle('location', createDefaultContext());
      expect(result.title).toContain('Amsterdam');
    });

    it('should generate Pulse title with country name', () => {
      const result = formatRailTitle('pulse', createDefaultContext());
      expect(result.title).toContain('Netherlands');
    });

    it('should handle missing location city gracefully', () => {
      const context = { ...createDefaultContext(), locationCity: undefined };
      const result = formatRailTitle('location', context);
      expect(result.title).toContain('Your Area');
    });
  });

  describe('formatStreakText', () => {
    it('should return null for streak less than 2', () => {
      expect(formatStreakText(0)).toBeNull();
      expect(formatStreakText(1)).toBeNull();
    });

    it('should format streak of 2', () => {
      expect(formatStreakText(2)).toBe('2nd week in a row');
    });

    it('should format streak of 3', () => {
      expect(formatStreakText(3)).toBe('3rd week in a row');
    });

    it('should format streak of 4 and higher', () => {
      expect(formatStreakText(4)).toBe('4th week in a row');
      expect(formatStreakText(5)).toBe('5th week in a row');
    });

    it('should handle teens correctly', () => {
      expect(formatStreakText(11)).toBe('11th week in a row');
      expect(formatStreakText(12)).toBe('12th week in a row');
      expect(formatStreakText(13)).toBe('13th week in a row');
    });

    it('should handle 21st, 22nd, 23rd', () => {
      expect(formatStreakText(21)).toBe('21st week in a row');
      expect(formatStreakText(22)).toBe('22nd week in a row');
      expect(formatStreakText(23)).toBe('23rd week in a row');
    });
  });

  describe('formatRitualDayLabel', () => {
    it('should format day of week', () => {
      expect(formatRitualDayLabel('Monday')).toBe('Every Monday');
      expect(formatRitualDayLabel('Friday')).toBe('Every Friday');
    });

    it('should return Weekly for undefined day', () => {
      expect(formatRitualDayLabel(undefined)).toBe('Weekly');
    });
  });
});
