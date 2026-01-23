/**
 * Type definitions for the Hybrid Discovery System
 *
 * This module defines the type system for discovery rails that combine:
 * - Traditional rails (fixed, predictable categories)
 * - AI-driven rails (dynamic, context-adjusted)
 * - Mission mode (immediate intent queries)
 */

import type { EventWithAttendees } from "../hooks/hooks";

/**
 * Type of discovery section/rail
 * - traditional: Fixed rails like "Trending", "What's Happening Now"
 * - generative: AI-driven rails like "Based on your recent joins"
 * - utility: Mission mode for immediate intents
 */
export type DiscoverySectionType =
  | "traditional"
  | "generative"
  | "utility"
  | "social";

/**
 * Layout style for rendering the rail
 * - carousel: Horizontal scrolling cards
 * - mission_grid: Grid layout for mission mode (top 3 picks + map)
 */
export type DiscoveryLayoutType = "carousel" | "mission_grid";

/**
 * Mission mode intent types
 * Maps to specific event categories and time relevance
 */
export type MissionIntent = "lunch" | "coffee" | "drinks" | "explore";

/**
 * A single discovery section/rail
 */
export interface DiscoverySection {
  /** Type of rail (traditional/generative/utility) */
  type: DiscoverySectionType;

  /** Display title for the rail */
  title: string;

  /** Optional description/context (e.g., "Because you joined the Jazz festival") */
  description?: string;

  /** Events in this rail */
  items: EventWithAttendees[];

  /** Layout style for rendering */
  layout: DiscoveryLayoutType;

  /** Optional icon component for the rail header */
  icon?: React.ReactNode;
}

/**
 * Complete discovery layout with all rails
 * Returned by the get_discovery_rails RPC function
 */
export interface DiscoveryLayout {
  sections: DiscoverySection[];
}

/**
 * Mission mode response structure
 * Returned by the get_mission_mode_events RPC function
 */
export interface MissionModeResponse {
  intent: MissionIntent;
  events: MissionModeEvent[];
}

/**
 * Event with additional mission mode metadata
 */
export interface MissionModeEvent extends EventWithAttendees {
  /** Distance from user in kilometers */
  distance_km: number;

  /** Estimated walking time in minutes */
  walking_time_minutes: number;

  /** Event location coordinates */
  location: {
    lat: number;
    lng: number;
  };
}

/**
 * Intent configuration for mission mode pills
 */
export interface IntentConfig {
  intent: MissionIntent;
  label: string;
  emoji: string;
  description: string;
}

/**
 * Predefined intent configurations
 */
export const INTENT_CONFIGS: Record<MissionIntent, IntentConfig> = {
  lunch: {
    intent: "lunch",
    label: "Lunch Right Now",
    emoji: "🍽️",
    description: "Find dining spots within walking distance",
  },
  coffee: {
    intent: "coffee",
    label: "Coffee",
    emoji: "☕",
    description: "Grab a coffee nearby",
  },
  drinks: {
    intent: "drinks",
    label: "Drinks",
    emoji: "🍺",
    description: "Evening drinks and nightlife",
  },
  explore: {
    intent: "explore",
    label: "Explore",
    emoji: "🎭",
    description: "Discover culture and entertainment",
  },
};
