/**
 * Availability Engine - Smart Time Suggestion System
 *
 * This module computes the intersection of free time blocks between multiple users,
 * enabling "Smart Invite" functionality that suggests optimal meeting times.
 *
 * Key concepts:
 * - TimeSlot: A specific date/time window (e.g., "Tuesday 12:00-14:00")
 * - AvailabilityBlock: A user's available time range
 * - CommonAvailability: Intersection of all users' free times
 */

/**
 * A specific time slot representing a potential meeting time
 */
export interface TimeSlot {
  /** Start time of the slot */
  start: Date;
  /** End time of the slot */
  end: Date;
  /** Duration in minutes */
  durationMinutes: number;
  /** Human-readable label (e.g., "Tuesday 12:00") */
  label: string;
  /** Number of users available during this slot */
  availableCount: number;
  /** Whether all invited users are available */
  isUniversal: boolean;
}

/**
 * A single availability block (free time range)
 */
export interface AvailabilityBlock {
  /** Start of available time */
  start: Date;
  /** End of available time */
  end: Date;
}

/**
 * User availability data
 */
export interface UserAvailability {
  /** User's profile ID */
  userId: string;
  /** User's display name (for labels) */
  displayName?: string;
  /** Array of available time blocks */
  availableBlocks: AvailabilityBlock[];
}

/**
 * Result of common availability calculation
 */
export interface CommonAvailabilityResult {
  /** Best time slot where everyone is free (null if none exists) */
  bestSlot: TimeSlot | null;
  /** All common time slots, sorted by quality */
  commonSlots: TimeSlot[];
  /** Users who have no overlapping availability */
  unavailableUsers: string[];
  /** Total number of users considered */
  totalUsers: number;
}

/**
 * Options for availability calculation
 */
export interface AvailabilityOptions {
  /** Minimum meeting duration in minutes (default: 60) */
  minDurationMinutes?: number;
  /** Maximum number of slots to return (default: 5) */
  maxSlots?: number;
  /** Only return slots where everyone is free (default: false) */
  requireUniversal?: boolean;
  /** Start of time window to consider (default: now) */
  windowStart?: Date;
  /** End of time window to consider (default: 7 days from now) */
  windowEnd?: Date;
}

/**
 * Computes the intersection of free time blocks between multiple users.
 * 
 * This is the core "Smart Invite" function that enables the app to suggest
 * meeting times rather than asking "When are you free?"
 *
 * @param users - Array of user availability data
 * @param options - Configuration options
 * @returns Common availability result with best slot and all options
 *
 * @example
 * const result = getCommonAvailability([
 *   {
 *     userId: 'user1',
 *     displayName: 'Alice',
 *     availableBlocks: [
 *       { start: new Date('2026-01-28T10:00:00'), end: new Date('2026-01-28T14:00:00') },
 *     ],
 *   },
 *   {
 *     userId: 'user2',
 *     displayName: 'Bob',
 *     availableBlocks: [
 *       { start: new Date('2026-01-28T12:00:00'), end: new Date('2026-01-28T16:00:00') },
 *     ],
 *   },
 * ]);
 * // Returns: bestSlot = { start: 12:00, end: 14:00, isUniversal: true }
 */
export function getCommonAvailability(
  users: UserAvailability[],
  options: AvailabilityOptions = {}
): CommonAvailabilityResult {
  const {
    minDurationMinutes = 60,
    maxSlots = 5,
    requireUniversal = false,
    windowStart = new Date(),
    windowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  } = options;

  if (users.length === 0) {
    return {
      bestSlot: null,
      commonSlots: [],
      unavailableUsers: [],
      totalUsers: 0,
    };
  }

  // Single user - their availability is the common availability
  if (users.length === 1) {
    const slotsFromBlocks = users[0].availableBlocks
      .filter((block) => isBlockInWindow(block, windowStart, windowEnd))
      .filter((block) => getBlockDuration(block) >= minDurationMinutes)
      .map((block) => createTimeSlot(block, 1, 1));

    return {
      bestSlot: slotsFromBlocks[0] || null,
      commonSlots: slotsFromBlocks.slice(0, maxSlots),
      unavailableUsers: [],
      totalUsers: 1,
    };
  }

  // Collect all blocks from all users with user info
  const allBlocks: Array<{
    block: AvailabilityBlock;
    userId: string;
  }> = [];

  users.forEach((user) => {
    user.availableBlocks.forEach((block) => {
      if (isBlockInWindow(block, windowStart, windowEnd)) {
        allBlocks.push({ block, userId: user.userId });
      }
    });
  });

  // Find time points where availability changes
  const timePoints = new Set<number>();
  allBlocks.forEach(({ block }) => {
    timePoints.add(block.start.getTime());
    timePoints.add(block.end.getTime());
  });

  const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);

  // For each interval between time points, count available users
  const intervals: Array<{
    start: Date;
    end: Date;
    availableUserIds: Set<string>;
  }> = [];

  for (let i = 0; i < sortedTimePoints.length - 1; i++) {
    const intervalStart = new Date(sortedTimePoints[i]);
    const intervalEnd = new Date(sortedTimePoints[i + 1]);

    // Find users available during this entire interval
    const availableUserIds = new Set<string>();
    allBlocks.forEach(({ block, userId }) => {
      if (block.start <= intervalStart && block.end >= intervalEnd) {
        availableUserIds.add(userId);
      }
    });

    if (availableUserIds.size > 0) {
      intervals.push({
        start: intervalStart,
        end: intervalEnd,
        availableUserIds,
      });
    }
  }

  // Merge consecutive intervals with the same users
  const mergedIntervals: Array<{
    start: Date;
    end: Date;
    availableUserIds: Set<string>;
  }> = [];

  intervals.forEach((interval) => {
    const last = mergedIntervals[mergedIntervals.length - 1];
    if (
      last &&
      last.end.getTime() === interval.start.getTime() &&
      setsEqual(last.availableUserIds, interval.availableUserIds)
    ) {
      // Extend the previous interval
      last.end = interval.end;
    } else {
      mergedIntervals.push({ ...interval });
    }
  });

  // Convert to time slots, filtering by minimum duration
  const timeSlots: TimeSlot[] = mergedIntervals
    .filter((interval) => {
      const duration =
        (interval.end.getTime() - interval.start.getTime()) / (1000 * 60);
      return duration >= minDurationMinutes;
    })
    .map((interval) =>
      createTimeSlot(
        { start: interval.start, end: interval.end },
        interval.availableUserIds.size,
        users.length
      )
    );

  // Filter by universal requirement if specified
  const filteredSlots = requireUniversal
    ? timeSlots.filter((slot) => slot.isUniversal)
    : timeSlots;

  // Sort by quality: universal first, then by available count, then by start time
  filteredSlots.sort((a, b) => {
    if (a.isUniversal !== b.isUniversal) {
      return a.isUniversal ? -1 : 1;
    }
    if (a.availableCount !== b.availableCount) {
      return b.availableCount - a.availableCount;
    }
    return a.start.getTime() - b.start.getTime();
  });

  // Find users with no overlapping availability
  const usersWithOverlap = new Set<string>();
  mergedIntervals.forEach((interval) => {
    interval.availableUserIds.forEach((id) => usersWithOverlap.add(id));
  });

  const unavailableUsers = users
    .filter((u) => !usersWithOverlap.has(u.userId))
    .map((u) => u.userId);

  return {
    bestSlot: filteredSlots[0] || null,
    commonSlots: filteredSlots.slice(0, maxSlots),
    unavailableUsers,
    totalUsers: users.length,
  };
}

/**
 * Generates default availability blocks for a user.
 * 
 * Creates reasonable defaults for users who haven't set their calendar:
 * - Weekdays: 9:00-17:00 (business hours) and 18:00-22:00 (evening)
 * - Weekends: 10:00-22:00 (flexible)
 *
 * @param daysAhead - Number of days to generate (default: 7, max: 30)
 * @returns Array of availability blocks
 */
export function generateDefaultAvailability(
  daysAhead: number = 7
): AvailabilityBlock[] {
  // Validate daysAhead parameter
  const validDays = Math.min(Math.max(Math.floor(daysAhead), 1), 30);
  
  const blocks: AvailabilityBlock[] = [];
  const now = new Date();

  for (let i = 0; i < validDays; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      // Weekend: 10:00-22:00
      const start = new Date(date);
      start.setHours(10, 0, 0, 0);
      const end = new Date(date);
      end.setHours(22, 0, 0, 0);
      
      // Only add if not in the past
      if (end > now) {
        blocks.push({
          start: start > now ? start : now,
          end,
        });
      }
    } else {
      // Weekday lunch: 12:00-14:00
      const lunchStart = new Date(date);
      lunchStart.setHours(12, 0, 0, 0);
      const lunchEnd = new Date(date);
      lunchEnd.setHours(14, 0, 0, 0);
      
      if (lunchEnd > now) {
        blocks.push({
          start: lunchStart > now ? lunchStart : now,
          end: lunchEnd,
        });
      }

      // Weekday evening: 18:00-22:00
      const eveningStart = new Date(date);
      eveningStart.setHours(18, 0, 0, 0);
      const eveningEnd = new Date(date);
      eveningEnd.setHours(22, 0, 0, 0);
      
      if (eveningEnd > now) {
        blocks.push({
          start: eveningStart > now ? eveningStart : now,
          end: eveningEnd,
        });
      }
    }
  }

  return blocks;
}

/**
 * Formats a time slot as a human-readable suggestion string
 * 
 * @param slot - The time slot to format
 * @param totalUsers - Total number of invited users
 * @returns Formatted string like "Tuesday 12:00 (Everyone is free)"
 */
export function formatTimeSlotSuggestion(
  slot: TimeSlot,
  totalUsers?: number
): string {
  const count = totalUsers ?? slot.availableCount;
  
  if (slot.isUniversal) {
    return `${slot.label} (Everyone is free)`;
  }
  
  return `${slot.label} (${slot.availableCount}/${count} available)`;
}

// Helper functions

function isBlockInWindow(
  block: AvailabilityBlock,
  windowStart: Date,
  windowEnd: Date
): boolean {
  return block.end > windowStart && block.start < windowEnd;
}

function getBlockDuration(block: AvailabilityBlock): number {
  return (block.end.getTime() - block.start.getTime()) / (1000 * 60);
}

function createTimeSlot(
  block: AvailabilityBlock,
  availableCount: number,
  totalUsers: number
): TimeSlot {
  const durationMinutes = getBlockDuration(block);

  return {
    start: block.start,
    end: block.end,
    durationMinutes,
    label: formatSlotLabel(block.start),
    availableCount,
    isUniversal: availableCount === totalUsers,
  };
}

function formatSlotLabel(date: Date, locale?: string): string {
  // Use provided locale, or try to detect system locale, fallback to en-US
  const effectiveLocale = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = date.toLocaleTimeString(effectiveLocale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: effectiveLocale.startsWith('en'),
  });

  if (date.toDateString() === today.toDateString()) {
    return `Today ${time}`;
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${time}`;
  }

  const dayName = date.toLocaleDateString(effectiveLocale, { weekday: 'long' });
  return `${dayName} ${time}`;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
