/**
 * Unit tests for exponential backoff with jitter
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBackoffWithJitter,
  parseRetryAfter,
  getRetryDelay,
} from '../lib/backoff';

describe('Backoff utilities', () => {
  describe('calculateBackoffWithJitter', () => {
    it('should return 0 for first attempt with full jitter', () => {
      // For attempt 0, exponential is baseMs * 2^0 = baseMs
      // Full jitter returns random between 0 and baseMs
      const result = calculateBackoffWithJitter(0, 1000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1000);
    });

    it('should increase exponentially', () => {
      // Attempt 1: 1000 * 2^1 = 2000 (with jitter 0-2000)
      const result1 = calculateBackoffWithJitter(1, 1000, 10000);
      expect(result1).toBeGreaterThanOrEqual(0);
      expect(result1).toBeLessThanOrEqual(2000);

      // Attempt 2: 1000 * 2^2 = 4000 (with jitter 0-4000)
      const result2 = calculateBackoffWithJitter(2, 1000, 10000);
      expect(result2).toBeGreaterThanOrEqual(0);
      expect(result2).toBeLessThanOrEqual(4000);
    });

    it('should respect cap', () => {
      // Attempt 10 would normally be 1000 * 2^10 = 1024000
      // But cap is 5000
      const result = calculateBackoffWithJitter(10, 1000, 5000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(5000);
    });

    it('should handle zero base', () => {
      const result = calculateBackoffWithJitter(5, 0, 1000);
      expect(result).toBe(0);
    });
  });

  describe('parseRetryAfter', () => {
    it('should parse integer seconds', () => {
      expect(parseRetryAfter('60')).toBe(60000); // 60 seconds = 60000ms
      expect(parseRetryAfter('5')).toBe(5000);
      expect(parseRetryAfter('0')).toBe(null); // 0 is not valid
    });

    it('should parse HTTP date format', () => {
      const futureDate = new Date(Date.now() + 30000); // 30 seconds in future
      const result = parseRetryAfter(futureDate.toUTCString());
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(30000);
    });

    it('should return null for past dates', () => {
      const pastDate = new Date(Date.now() - 30000); // 30 seconds in past
      const result = parseRetryAfter(pastDate.toUTCString());
      expect(result).toBe(0); // Returns 0 for past dates
    });

    it('should return null for invalid input', () => {
      expect(parseRetryAfter(null)).toBe(null);
      expect(parseRetryAfter(undefined)).toBe(null);
      expect(parseRetryAfter('invalid')).toBe(null);
      expect(parseRetryAfter('')).toBe(null);
    });

    it('should handle negative numbers', () => {
      expect(parseRetryAfter('-5')).toBe(null); // Negative is invalid
    });
  });

  describe('getRetryDelay', () => {
    it('should prefer Retry-After header when present', () => {
      const result = getRetryDelay(5, '10'); // 10 seconds
      expect(result).toBe(10000);
    });

    it('should use exponential backoff when no Retry-After', () => {
      const result = getRetryDelay(1, null, 1000, 10000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(2000); // 1000 * 2^1 = 2000
    });

    it('should cap Retry-After at maximum', () => {
      const result = getRetryDelay(0, '500', 1000, 10000); // 500 seconds = 500000ms
      expect(result).toBe(10000); // Capped at 10000ms
    });

    it('should fall back to backoff for invalid Retry-After', () => {
      const result = getRetryDelay(2, 'invalid', 1000, 10000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(4000); // 1000 * 2^2 = 4000
    });
  });
});
