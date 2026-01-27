import { describe, it, expect } from 'vitest';
import {
  getCommonAvailability,
  generateDefaultAvailability,
  formatTimeSlotSuggestion,
  type UserAvailability,
  type AvailabilityBlock,
} from '../availabilityEngine';

describe('availabilityEngine', () => {
  // Helper to create dates relative to now
  const createDate = (daysOffset: number, hours: number, minutes: number = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  describe('getCommonAvailability', () => {
    it('should return empty result for no users', () => {
      const result = getCommonAvailability([]);

      expect(result.bestSlot).toBeNull();
      expect(result.commonSlots).toHaveLength(0);
      expect(result.totalUsers).toBe(0);
    });

    it('should return user availability for single user', () => {
      const user: UserAvailability = {
        userId: 'user1',
        displayName: 'Alice',
        availableBlocks: [
          { start: createDate(1, 10), end: createDate(1, 14) },
        ],
      };

      const result = getCommonAvailability([user]);

      expect(result.bestSlot).not.toBeNull();
      expect(result.bestSlot!.isUniversal).toBe(true);
      expect(result.totalUsers).toBe(1);
    });

    it('should find intersection of two users with overlapping availability', () => {
      const users: UserAvailability[] = [
        {
          userId: 'user1',
          availableBlocks: [
            { start: createDate(1, 10), end: createDate(1, 14) }, // 10:00-14:00
          ],
        },
        {
          userId: 'user2',
          availableBlocks: [
            { start: createDate(1, 12), end: createDate(1, 16) }, // 12:00-16:00
          ],
        },
      ];

      const result = getCommonAvailability(users);

      expect(result.bestSlot).not.toBeNull();
      expect(result.bestSlot!.isUniversal).toBe(true);
      expect(result.bestSlot!.availableCount).toBe(2);
      
      // Intersection should be 12:00-14:00
      expect(result.bestSlot!.start.getHours()).toBe(12);
      expect(result.bestSlot!.end.getHours()).toBe(14);
    });

    it('should handle non-overlapping availability', () => {
      const users: UserAvailability[] = [
        {
          userId: 'user1',
          availableBlocks: [
            { start: createDate(1, 10), end: createDate(1, 12) },
          ],
        },
        {
          userId: 'user2',
          availableBlocks: [
            { start: createDate(1, 14), end: createDate(1, 16) },
          ],
        },
      ];

      const result = getCommonAvailability(users, { requireUniversal: true });

      // No universal slot since users don't overlap
      expect(result.bestSlot).toBeNull();
    });

    it('should filter by minimum duration', () => {
      const users: UserAvailability[] = [
        {
          userId: 'user1',
          availableBlocks: [
            { start: createDate(1, 10), end: createDate(1, 14) },
          ],
        },
        {
          userId: 'user2',
          availableBlocks: [
            // Only 30 minutes overlap (13:30-14:00)
            { start: createDate(1, 13, 30), end: createDate(1, 16) },
          ],
        },
      ];

      const result = getCommonAvailability(users, { minDurationMinutes: 60 });

      // No slot meets 60 minute minimum
      expect(result.commonSlots.filter(s => s.isUniversal)).toHaveLength(0);
    });

    it('should respect maxSlots option', () => {
      const user: UserAvailability = {
        userId: 'user1',
        availableBlocks: [
          { start: createDate(1, 10), end: createDate(1, 12) },
          { start: createDate(2, 10), end: createDate(2, 12) },
          { start: createDate(3, 10), end: createDate(3, 12) },
          { start: createDate(4, 10), end: createDate(4, 12) },
          { start: createDate(5, 10), end: createDate(5, 12) },
          { start: createDate(6, 10), end: createDate(6, 12) },
        ],
      };

      const result = getCommonAvailability([user], { maxSlots: 3 });

      expect(result.commonSlots.length).toBeLessThanOrEqual(3);
    });

    it('should identify unavailable users', () => {
      const users: UserAvailability[] = [
        {
          userId: 'user1',
          availableBlocks: [
            { start: createDate(1, 10), end: createDate(1, 14) },
          ],
        },
        {
          userId: 'user2',
          availableBlocks: [], // No availability
        },
      ];

      const result = getCommonAvailability(users);

      expect(result.unavailableUsers).toContain('user2');
    });

    it('should prioritize universal slots', () => {
      const users: UserAvailability[] = [
        {
          userId: 'user1',
          availableBlocks: [
            { start: createDate(1, 10), end: createDate(1, 16) },
          ],
        },
        {
          userId: 'user2',
          availableBlocks: [
            { start: createDate(1, 12), end: createDate(1, 14) }, // Universal overlap
          ],
        },
      ];

      const result = getCommonAvailability(users);

      // Best slot should be the universal one (12:00-14:00)
      expect(result.bestSlot!.isUniversal).toBe(true);
    });

    it('should handle multiple overlapping blocks', () => {
      const users: UserAvailability[] = [
        {
          userId: 'user1',
          availableBlocks: [
            { start: createDate(1, 9), end: createDate(1, 12) },
            { start: createDate(1, 14), end: createDate(1, 18) },
          ],
        },
        {
          userId: 'user2',
          availableBlocks: [
            { start: createDate(1, 10), end: createDate(1, 11) },
            { start: createDate(1, 15), end: createDate(1, 17) },
          ],
        },
      ];

      const result = getCommonAvailability(users);

      // Should find both overlapping periods
      const universalSlots = result.commonSlots.filter(s => s.isUniversal);
      expect(universalSlots.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateDefaultAvailability', () => {
    it('should generate availability for specified number of days', () => {
      const blocks = generateDefaultAvailability(3);

      // Should have at least some blocks
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should generate blocks in the future', () => {
      const now = new Date();
      const blocks = generateDefaultAvailability(7);

      blocks.forEach((block) => {
        expect(block.end.getTime()).toBeGreaterThan(now.getTime());
      });
    });

    it('should have valid block structure', () => {
      const blocks = generateDefaultAvailability(7);

      blocks.forEach((block) => {
        expect(block.start).toBeInstanceOf(Date);
        expect(block.end).toBeInstanceOf(Date);
        expect(block.end.getTime()).toBeGreaterThan(block.start.getTime());
      });
    });
  });

  describe('formatTimeSlotSuggestion', () => {
    it('should format universal slot correctly', () => {
      const slot = {
        start: new Date(),
        end: new Date(),
        durationMinutes: 60,
        label: 'Tuesday 12:00 PM',
        availableCount: 3,
        isUniversal: true,
      };

      const result = formatTimeSlotSuggestion(slot);

      expect(result).toBe('Tuesday 12:00 PM (Everyone is free)');
    });

    it('should format partial availability correctly', () => {
      const slot = {
        start: new Date(),
        end: new Date(),
        durationMinutes: 60,
        label: 'Wednesday 2:00 PM',
        availableCount: 2,
        isUniversal: false,
      };

      const result = formatTimeSlotSuggestion(slot, 3);

      expect(result).toBe('Wednesday 2:00 PM (2/3 available)');
    });
  });
});
