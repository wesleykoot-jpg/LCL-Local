/**
 * Title Formatter Utility
 * 
 * Generates evocative, location-aware headers for Discovery Rails.
 * Creates dynamic titles like:
 * - "Zwolle's Saturday Night"
 * - "Your Tuesday Rituals"
 * - "This Weekend in Amsterdam"
 * - "The Pulse of Netherlands"
 */

import type { RailType, RailContext } from "./types";

/**
 * Get day of week name
 */
function getDayName(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Get time of day greeting
 */
function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

/**
 * Format location name for display (capitalize, clean up)
 */
function formatLocationName(location: string | undefined): string {
  if (!location) return "Your Area";
  // Capitalize first letter of each word
  return location
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get possessive form of a location name
 */
function getPossessive(name: string): string {
  if (name.endsWith("s")) {
    return `${name}'`;
  }
  return `${name}'s`;
}

/**
 * Generate title for "For You" rail
 */
function generateForYouTitle(_context: RailContext): string {
  const timeOfDay = getTimeOfDay();
  const dayName = getDayName();
  
  // Vary based on time of day
  const titles = {
    morning: "Your Morning Picks",
    afternoon: "Made for You",
    evening: `Your ${dayName} Evening`,
    night: "Tonight, For You",
  };
  
  return titles[timeOfDay];
}

/**
 * Generate description for "For You" rail
 */
function generateForYouDescription(context: RailContext): string {
  if (context.selectedCategories && context.selectedCategories.length > 0) {
    const categoryText = context.selectedCategories.slice(0, 2).join(" & ");
    return `Based on your love for ${categoryText}`;
  }
  return "Curated based on your preferences";
}

/**
 * Generate title for "Rituals" rail
 */
function generateRitualsTitle(context: RailContext): string {
  const dayName = getDayName();
  const location = formatLocationName(context.locationCity);
  
  const variations = [
    `Your ${dayName} Rituals`,
    `Weekly Rhythm`,
    `Community Rituals`,
    `${location} Regulars`,
  ];
  
  // Pick based on day (deterministic for consistency)
  const dayIndex = new Date().getDay();
  return variations[dayIndex % variations.length];
}

/**
 * Generate description for "Rituals" rail
 */
function generateRitualsDescription(): string {
  const descriptions = [
    "Events that become traditions",
    "Weekly meetups & recurring groups",
    "Build your social rhythm",
    "The events that keep coming back",
  ];
  
  const index = new Date().getDay() % descriptions.length;
  return descriptions[index];
}

/**
 * Generate title for "This Weekend" rail
 */
function generateThisWeekendTitle(context: RailContext): string {
  const location = formatLocationName(context.locationCity);
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  // If it's already weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return `This Weekend in ${location}`;
  }
  
  // If Friday
  if (dayOfWeek === 5) {
    return `Weekend Starts Now`;
  }
  
  // Weekday - anticipation mode
  return `This Weekend`;
}

/**
 * Generate description for "This Weekend" rail
 */
function generateThisWeekendDescription(_context: RailContext): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  if (dayOfWeek === 5) {
    return "The wait is over";
  }
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return "Make the most of it";
  }
  
  // Calculate days until weekend
  const daysUntil = 6 - dayOfWeek;
  if (daysUntil === 1) {
    return "Just one more day";
  }
  return `${daysUntil} days to go`;
}

/**
 * Generate title for "Location" rail
 */
function generateLocationTitle(context: RailContext): string {
  const location = formatLocationName(context.locationCity);
  const timeOfDay = getTimeOfDay();
  const dayName = getDayName();
  
  const variations = {
    morning: `${location} This Morning`,
    afternoon: `Happening in ${location}`,
    evening: `${getPossessive(location)} ${dayName} Night`,
    night: `${location} After Dark`,
  };
  
  return variations[timeOfDay];
}

/**
 * Generate description for "Location" rail
 */
function generateLocationDescription(context: RailContext): string {
  const radiusKm = context.radiusKm || 25;
  if (radiusKm <= 5) {
    return "Steps away from you";
  }
  if (radiusKm <= 10) {
    return "In your neighborhood";
  }
  return "Around your area";
}

/**
 * Generate title for "Pulse" rail
 */
function generatePulseTitle(context: RailContext): string {
  const country = context.country || "Your Region";
  const formattedCountry = formatLocationName(country);
  
  return `Pulse of ${formattedCountry}`;
}

/**
 * Generate description for "Pulse" rail
 */
function generatePulseDescription(_context: RailContext): string {
  return "Where the crowd gathers";
}

/**
 * Main title formatter - generates title and description for a rail
 */
export function formatRailTitle(
  railType: RailType,
  context: RailContext
): { title: string; description: string } {
  switch (railType) {
    case "for-you":
      return {
        title: generateForYouTitle(context),
        description: generateForYouDescription(context),
      };
    case "rituals":
      return {
        title: generateRitualsTitle(context),
        description: generateRitualsDescription(),
      };
    case "this-weekend":
      return {
        title: generateThisWeekendTitle(context),
        description: generateThisWeekendDescription(context),
      };
    case "location":
      return {
        title: generateLocationTitle(context),
        description: generateLocationDescription(context),
      };
    case "pulse":
      return {
        title: generatePulseTitle(context),
        description: generatePulseDescription(context),
      };
    default:
      return {
        title: "Discover",
        description: "Find something new",
      };
  }
}

/**
 * Format streak text for ritual events
 * e.g., "3rd week in a row"
 */
export function formatStreakText(streak: number): string | null {
  if (streak < 2) return null;
  
  const suffix = getOrdinalSuffix(streak);
  return `${streak}${suffix} week in a row`;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 * 
 * The algorithm handles English ordinal suffixes:
 * - Numbers 11-13 always use "th" (11th, 12th, 13th)
 * - Numbers ending in 1 use "st" (1st, 21st, 31st)
 * - Numbers ending in 2 use "nd" (2nd, 22nd, 32nd)
 * - Numbers ending in 3 use "rd" (3rd, 23rd, 33rd)
 * - All other numbers use "th"
 */
function getOrdinalSuffix(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = n % 100;
  
  // Special case: 11, 12, 13 always use "th"
  // For other numbers, use the last digit to determine suffix
  // (v - 20) % 10 handles numbers > 20 by getting last digit
  return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
}

/**
 * Format ritual day label
 * e.g., "Every Tuesday" or "Weekly"
 */
export function formatRitualDayLabel(dayOfWeek: string | undefined): string {
  if (!dayOfWeek) return "Weekly";
  return `Every ${dayOfWeek}`;
}
