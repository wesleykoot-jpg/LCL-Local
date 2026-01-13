import { describe, expect, it } from 'vitest';
import {
  formatEventDate,
  formatEventTime,
  formatEventLocation,
  getEventCoordinates,
} from '../formatters';

describe('formatEventDate', () => {
  it('returns "Vandaag" for today\'s date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(formatEventDate(today)).toBe('Vandaag');
  });

  it('returns "Morgen" for tomorrow\'s date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    expect(formatEventDate(tomorrowStr)).toBe('Morgen');
  });

  it('formats future dates in Dutch locale', () => {
    // Use a date far in the future to ensure it's not today/tomorrow
    const futureDate = '2026-06-15';
    const result = formatEventDate(futureDate);
    // Should contain Dutch weekday abbreviation and day number
    expect(result).toMatch(/\w+\s+\d+/);
  });

  it('handles ISO timestamp strings', () => {
    const today = new Date().toISOString();
    expect(formatEventDate(today)).toBe('Vandaag');
  });
});

describe('formatEventTime', () => {
  it('formats HH:MM times with leading zeros', () => {
    expect(formatEventTime('9:30')).toBe('09:30');
    expect(formatEventTime('20:00')).toBe('20:00');
  });

  it('returns empty string for TBD', () => {
    expect(formatEventTime('TBD')).toBe('');
    expect(formatEventTime('tbd')).toBe('');
  });

  it('returns "Hele dag" for all-day indicators', () => {
    expect(formatEventTime('Hele dag')).toBe('Hele dag');
    expect(formatEventTime('hele dag')).toBe('Hele dag');
    expect(formatEventTime('all day')).toBe('Hele dag');
  });

  it('handles descriptive times', () => {
    expect(formatEventTime('Avond')).toBe('Avond');
    expect(formatEventTime('Middag')).toBe('Middag');
    expect(formatEventTime('Ochtend')).toBe('Ochtend');
  });

  it('respects structured date all_day flag', () => {
    const structuredDate = { utc_start: '2026-01-15T00:00:00Z', all_day: true };
    expect(formatEventTime('20:00', structuredDate)).toBe('Hele dag');
  });
});

describe('formatEventLocation', () => {
  it('returns venue name when no structured location', () => {
    expect(formatEventLocation('Test Venue')).toBe('Test Venue');
  });

  it('prefers structured location name', () => {
    const structured = { name: 'Structured Venue', coordinates: { lat: 52, lng: 4 } };
    expect(formatEventLocation('Legacy Venue', structured)).toBe('Structured Venue');
  });

  it('returns default text for empty location', () => {
    expect(formatEventLocation('')).toBe('Locatie onbekend');
  });
});

describe('getEventCoordinates', () => {
  it('parses POINT format correctly', () => {
    const coords = getEventCoordinates('POINT(4.8945 52.3667)');
    expect(coords).toEqual({ lat: 52.3667, lng: 4.8945 });
  });

  it('returns structured coordinates if available', () => {
    const structured = { name: 'Test', coordinates: { lat: 52, lng: 4 } };
    const coords = getEventCoordinates('POINT(5 53)', structured);
    expect(coords).toEqual({ lat: 52, lng: 4 });
  });

  it('returns null for invalid location', () => {
    expect(getEventCoordinates(null)).toBeNull();
    expect(getEventCoordinates('invalid')).toBeNull();
  });
});
