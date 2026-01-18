import { describe, expect, it } from 'vitest';
import { isMidnightTime } from '../SmartTimeLabel';

describe('SmartTimeLabel', () => {
  describe('isMidnightTime', () => {
    it('should return true for "00:00"', () => {
      expect(isMidnightTime('00:00')).toBe(true);
    });

    it('should return true for "0:00"', () => {
      expect(isMidnightTime('0:00')).toBe(true);
    });

    it('should return true for "00:00:00"', () => {
      expect(isMidnightTime('00:00:00')).toBe(true);
    });

    it('should return true for midnight with whitespace', () => {
      expect(isMidnightTime(' 00:00 ')).toBe(true);
    });

    it('should return false for non-midnight times', () => {
      expect(isMidnightTime('19:30')).toBe(false);
      expect(isMidnightTime('08:00')).toBe(false);
      expect(isMidnightTime('12:00')).toBe(false);
      expect(isMidnightTime('23:59')).toBe(false);
    });

    it('should return false for null/undefined/empty', () => {
      expect(isMidnightTime(null)).toBe(false);
      expect(isMidnightTime(undefined)).toBe(false);
      expect(isMidnightTime('')).toBe(false);
    });
  });
});
