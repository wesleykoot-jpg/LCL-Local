/**
 * Category Localization Layer
 * 
 * Maps language-agnostic CategoryKey values (e.g., 'MUSIC') 
 * to localized Dutch/English labels for display.
 * 
 * Database stores: 'MUSIC' (uppercase, language-neutral)
 * Display shows: "Muziek" (Dutch, default) or "Music" (English)
 */

import { Music2, Users, Dumbbell, Palette, UtensilsCrossed, PartyPopper, Baby, Landmark, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CategoryKey = 'MUSIC' | 'SOCIAL' | 'ACTIVE' | 'CULTURE' | 'FOOD' | 'NIGHTLIFE' | 'FAMILY' | 'CIVIC' | 'COMMUNITY';
export type Language = 'nl' | 'en';

interface CategoryDisplay {
  nl: string;
  en: string;
  icon: LucideIcon;
  color: string;
}

/**
 * Master category display configuration
 * Each CategoryKey maps to Dutch/English labels, icon, and color
 */
export const CATEGORY_DISPLAY_MAP: Record<CategoryKey, CategoryDisplay> = {
  MUSIC: {
    nl: 'Muziek',
    en: 'Music',
    icon: Music2,
    color: 'indigo'
  },
  SOCIAL: {
    nl: 'Sociaal',
    en: 'Social',
    icon: Users,
    color: 'blue'
  },
  ACTIVE: {
    nl: 'Actief',
    en: 'Active',
    icon: Dumbbell,
    color: 'orange'
  },
  CULTURE: {
    nl: 'Cultuur',
    en: 'Culture',
    icon: Palette,
    color: 'rose'
  },
  FOOD: {
    nl: 'Eten & Drinken',
    en: 'Food & Drink',
    icon: UtensilsCrossed,
    color: 'pink'
  },
  NIGHTLIFE: {
    nl: 'Uitgaan',
    en: 'Nightlife',
    icon: PartyPopper,
    color: 'violet'
  },
  FAMILY: {
    nl: 'Familie',
    en: 'Family',
    icon: Baby,
    color: 'teal'
  },
  CIVIC: {
    nl: 'Maatschappij',
    en: 'Civic',
    icon: Landmark,
    color: 'amber'
  },
  COMMUNITY: {
    nl: 'Community',
    en: 'Community',
    icon: MapPin,
    color: 'slate'
  }
};

/**
 * Get localized display label for a category key
 * @param key - The uppercase category key from database (e.g., 'MUSIC')
 * @param lang - User's preferred language (defaults to Dutch)
 * @returns Localized label (e.g., "Muziek" or "Music")
 */
export function getCategoryLabel(key: CategoryKey, lang: Language = 'nl'): string {
  return CATEGORY_DISPLAY_MAP[key]?.[lang] || key;
}

/**
 * Get category icon component
 * @param key - The uppercase category key
 * @returns Lucide icon component
 */
export function getCategoryIcon(key: CategoryKey): LucideIcon {
  return CATEGORY_DISPLAY_MAP[key]?.icon || MapPin;
}

/**
 * Get category color token
 * @param key - The uppercase category key
 * @returns Color name (e.g., 'indigo', 'blue')
 */
export function getCategoryColor(key: CategoryKey): string {
  return CATEGORY_DISPLAY_MAP[key]?.color || 'slate';
}

/**
 * Get full category configuration for UI rendering
 * Includes label, icon, color, and Tailwind classes
 * 
 * @param key - The uppercase category key
 * @param lang - User's preferred language (defaults to Dutch)
 * @returns Complete category configuration object
 */
export function getCategoryConfig(key: CategoryKey, lang: Language = 'nl') {
  const display = CATEGORY_DISPLAY_MAP[key] || CATEGORY_DISPLAY_MAP.COMMUNITY;
  const color = display.color;
  
  return {
    key,
    label: display[lang],
    labelNL: display.nl,
    labelEN: display.en,
    icon: display.icon,
    color,
    // Tailwind CSS classes (can't use string interpolation with Tailwind JIT)
    dotClass: `bg-${color}-500`,
    bgClass: `bg-${color}-500/10`,
    textClass: `text-${color}-600`,
    borderClass: `border-${color}-500/20`
  };
}

/**
 * Get all available category keys
 * @returns Array of all CategoryKey values
 */
export function getAllCategoryKeys(): CategoryKey[] {
  return Object.keys(CATEGORY_DISPLAY_MAP) as CategoryKey[];
}

/**
 * Check if a string is a valid CategoryKey
 * @param value - String to check
 * @returns True if value is a valid CategoryKey
 */
export function isValidCategoryKey(value: string): value is CategoryKey {
  return value in CATEGORY_DISPLAY_MAP;
}

/**
 * Legacy compatibility: Map old lowercase category IDs to CategoryKey
 * Used during migration period
 * 
 * @param legacyId - Old lowercase category ID (e.g., 'music', 'active')
 * @returns Uppercase CategoryKey
 */
export function legacyIdToKey(legacyId: string): CategoryKey {
  const mapping: Record<string, CategoryKey> = {
    'music': 'MUSIC',
    'active': 'ACTIVE',
    'social': 'SOCIAL',
    'family': 'FAMILY',
    'foodie': 'FOOD',
    'food': 'FOOD',
    'entertainment': 'CULTURE',
    'gaming': 'CULTURE',
    'workshops': 'CULTURE',
    'arts': 'CULTURE',
    'outdoors': 'ACTIVE',
    'sports': 'ACTIVE',
    'wellness': 'ACTIVE',
    'nightlife': 'NIGHTLIFE',
    'club': 'NIGHTLIFE',
    'community': 'COMMUNITY',
    'market': 'FOOD',
    'crafts': 'CULTURE',
    'cinema': 'CULTURE'
  };
  
  return mapping[legacyId.toLowerCase()] || 'COMMUNITY';
}
