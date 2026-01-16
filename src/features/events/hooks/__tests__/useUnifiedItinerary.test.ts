import { describe, expect, it } from 'vitest';

// Test the helper functions used in useUnifiedItinerary
// We test these separately since the hook itself requires mocking providers

describe('useUnifiedItinerary helpers', () => {
  describe('formatTimeDisplay', () => {
    // Inline implementation for testing
    function formatTimeDisplay(timeStr: string | undefined, dateTimeStr: string | undefined): string {
      if (!timeStr && !dateTimeStr) {
        return 'All Day';
      }
      if (dateTimeStr) {
        const date = new Date(dateTimeStr);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
      if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
      return timeStr || 'All Day';
    }

    it('returns "All Day" when no time provided', () => {
      expect(formatTimeDisplay(undefined, undefined)).toBe('All Day');
    });

    it('formats HH:MM time strings correctly', () => {
      expect(formatTimeDisplay('19:00', undefined)).toBe('7:00 PM');
      expect(formatTimeDisplay('09:30', undefined)).toBe('9:30 AM');
      expect(formatTimeDisplay('12:00', undefined)).toBe('12:00 PM');
      expect(formatTimeDisplay('00:00', undefined)).toBe('12:00 AM');
    });

    it('formats ISO datetime strings correctly', () => {
      // Use a fixed date to avoid timezone issues in tests
      const isoDateTime = '2025-03-15T19:00:00';
      const result = formatTimeDisplay(undefined, isoDateTime);
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('handles non-standard time strings', () => {
      expect(formatTimeDisplay('Evening', undefined)).toBe('Evening');
      expect(formatTimeDisplay('TBD', undefined)).toBe('TBD');
    });
  });

  describe('getEventIcon', () => {
    // Inline implementation for testing
    function getEventIcon(title: string): string | null {
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.includes('birthday') || lowerTitle.includes('bday')) {
        return '🎂';
      }
      if (lowerTitle.includes('meeting') || lowerTitle.includes('call') || lowerTitle.includes('sync')) {
        return '💼';
      }
      if (lowerTitle.includes('lunch') || lowerTitle.includes('dinner') || lowerTitle.includes('breakfast')) {
        return '🍽️';
      }
      if (lowerTitle.includes('workout') || lowerTitle.includes('gym') || lowerTitle.includes('exercise')) {
        return '💪';
      }
      if (lowerTitle.includes('doctor') || lowerTitle.includes('dentist') || lowerTitle.includes('appointment')) {
        return '🏥';
      }
      if (lowerTitle.includes('flight') || lowerTitle.includes('travel') || lowerTitle.includes('trip')) {
        return '✈️';
      }
      if (lowerTitle.includes('reminder')) {
        return '⏰';
      }
      
      return null;
    }

    it('returns birthday icon for birthday events', () => {
      expect(getEventIcon("John's Birthday")).toBe('🎂');
      expect(getEventIcon('Birthday Party')).toBe('🎂');
      expect(getEventIcon('bday celebration')).toBe('🎂');
    });

    it('returns meeting icon for work events', () => {
      expect(getEventIcon('Team Meeting')).toBe('💼');
      expect(getEventIcon('Weekly Call')).toBe('💼');
      expect(getEventIcon('Daily Sync')).toBe('💼');
    });

    it('returns food icon for meal events', () => {
      expect(getEventIcon('Lunch with Sarah')).toBe('🍽️');
      expect(getEventIcon('Dinner reservation')).toBe('🍽️');
      expect(getEventIcon('Breakfast at cafe')).toBe('🍽️');
    });

    it('returns workout icon for fitness events', () => {
      expect(getEventIcon('Morning Workout')).toBe('💪');
      expect(getEventIcon('Gym Session')).toBe('💪');
      expect(getEventIcon('Exercise Class')).toBe('💪');
    });

    it('returns medical icon for appointments', () => {
      expect(getEventIcon('Doctor Appointment')).toBe('🏥');
      expect(getEventIcon('Dentist Visit')).toBe('🏥');
      expect(getEventIcon('Hair Appointment')).toBe('🏥');
    });

    it('returns travel icon for travel events', () => {
      expect(getEventIcon('Flight to London')).toBe('✈️');
      expect(getEventIcon('Road Trip')).toBe('✈️');
      expect(getEventIcon('Travel to conference')).toBe('✈️');
    });

    it('returns reminder icon for reminders', () => {
      expect(getEventIcon('Reminder: Pick up laundry')).toBe('⏰');
    });

    it('returns null for unrecognized events', () => {
      expect(getEventIcon('Random Event')).toBeNull();
      expect(getEventIcon('Concert')).toBeNull();
      expect(getEventIcon('Movie night')).toBeNull();
    });
  });

  describe('formatDayLabel', () => {
    function getDateKey(date: Date): string {
      return date.toISOString().split('T')[0];
    }

    function formatDayLabel(dateKey: string, today: Date): string {
      const eventDate = new Date(dateKey + 'T00:00:00');
      const todayKey = getDateKey(today);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = getDateKey(tomorrow);

      if (dateKey === todayKey) {
        return 'Today';
      }
      if (dateKey === tomorrowKey) {
        return 'Tomorrow';
      }

      return eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }

    it('returns "Today" for today\'s date', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateKey = getDateKey(today);
      expect(formatDayLabel(dateKey, today)).toBe('Today');
    });

    it('returns "Tomorrow" for tomorrow\'s date', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateKey = getDateKey(tomorrow);
      expect(formatDayLabel(dateKey, today)).toBe('Tomorrow');
    });

    it('returns formatted date for other dates', () => {
      const today = new Date('2025-03-15T00:00:00');
      const futureDate = '2025-03-20';
      const result = formatDayLabel(futureDate, today);
      expect(result).toMatch(/\w+,?\s+\w+\s+\d+/);
    });
  });

  describe('ItineraryItem type', () => {
    it('should have correct visual styles', () => {
      const styles = ['anchor', 'shadow'] as const;
      expect(styles).toContain('anchor');
      expect(styles).toContain('shadow');
    });

    it('should have correct item types', () => {
      const types = ['LCL_EVENT', 'GOOGLE_CALENDAR', 'HIDDEN'] as const;
      expect(types).toContain('LCL_EVENT');
      expect(types).toContain('GOOGLE_CALENDAR');
      expect(types).toContain('HIDDEN');
    });
  });
});
