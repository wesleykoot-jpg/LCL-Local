/**
 * Tests for timeHelpers utilities
 */

import { describe, it, expect } from 'vitest';
import { 
  formatDate, 
  formatTime, 
  getRelativeTimeLabel,
  doEventsOverlap,
  detectConflicts,
  formatDuration,
  isEventLiveNow
} from '../timeHelpers';
import { addHours, addDays } from 'date-fns';

describe('timeHelpers', () => {
  describe('formatTime', () => {
    it('should format time in HH:MM format', () => {
      expect(formatTime('9:30')).toBe('09:30');
      expect(formatTime('14:45')).toBe('14:45');
      expect(formatTime('23:00')).toBe('23:00');
    });
    
    it('should handle already formatted time', () => {
      expect(formatTime('09:30')).toBe('09:30');
    });
    
    it('should return empty string for invalid input', () => {
      expect(formatTime('')).toBe('');
    });
  });
  
  describe('doEventsOverlap', () => {
    it('should detect overlapping events', () => {
      const now = new Date();
      const event1 = {
        startTime: now,
        endTime: addHours(now, 2)
      };
      const event2 = {
        startTime: addHours(now, 1),
        endTime: addHours(now, 3)
      };
      
      expect(doEventsOverlap(event1, event2)).toBe(true);
    });
    
    it('should not detect non-overlapping events', () => {
      const now = new Date();
      const event1 = {
        startTime: now,
        endTime: addHours(now, 2)
      };
      const event2 = {
        startTime: addHours(now, 3),
        endTime: addHours(now, 5)
      };
      
      expect(doEventsOverlap(event1, event2)).toBe(false);
    });
    
    it('should use default 2-hour duration when endTime is missing', () => {
      const now = new Date();
      const event1 = {
        startTime: now,
      };
      const event2 = {
        startTime: addHours(now, 1),
      };
      
      expect(doEventsOverlap(event1, event2)).toBe(true);
    });
  });
  
  describe('detectConflicts', () => {
    it('should detect multiple conflicts', () => {
      const now = new Date();
      const events = [
        { startTime: now, endTime: addHours(now, 2) },
        { startTime: addHours(now, 1), endTime: addHours(now, 3) },
        { startTime: addHours(now, 4), endTime: addHours(now, 5) },
      ];
      
      const conflicts = detectConflicts(events);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual([0, 1]);
    });
    
    it('should return empty array when no conflicts', () => {
      const now = new Date();
      const events = [
        { startTime: now, endTime: addHours(now, 1) },
        { startTime: addHours(now, 2), endTime: addHours(now, 3) },
      ];
      
      const conflicts = detectConflicts(events);
      expect(conflicts).toHaveLength(0);
    });
  });
  
  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(formatDuration(45)).toBe('45m');
    });
    
    it('should format hours only', () => {
      expect(formatDuration(120)).toBe('2h');
    });
    
    it('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(135)).toBe('2h 15m');
    });
  });
  
  describe('isEventLiveNow', () => {
    it('should return true for event happening now', () => {
      const now = new Date();
      const eventDate = now.toISOString().split('T')[0];
      const eventTime = `${now.getHours()}:${now.getMinutes()}`;
      
      expect(isEventLiveNow(eventDate, eventTime, 2)).toBe(true);
    });
    
    it('should return false for future event', () => {
      const tomorrow = addDays(new Date(), 1);
      const eventDate = tomorrow.toISOString().split('T')[0];
      
      expect(isEventLiveNow(eventDate, '10:00', 2)).toBe(false);
    });
  });
});
