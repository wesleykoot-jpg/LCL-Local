/**
 * Category Configuration
 * 
 * Re-exports from the localization layer for backward compatibility.
 * All new code should import from @/shared/lib/localization directly.
 */

import { 
  getCategoryConfig as getConfig,
  getCategoryLabel,
  getCategoryIcon,
  getCategoryColor,
  legacyIdToKey,
  CATEGORY_DISPLAY_MAP,
  type CategoryKey 
} from '@/shared/lib/localization';

// Re-export for backward compatibility
export { getCategoryLabel, getCategoryIcon, getCategoryColor, legacyIdToKey };
export type { CategoryKey };

/**
 * Category configuration interface (backward compatible)
 */
export interface CategoryConfig {
  id: string;
  label: string;
  dotClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

/**
 * Get category configuration by key or legacy ID
 * Supports both uppercase keys ('MUSIC') and lowercase legacy IDs ('music')
 * 
 * @param categoryId - CategoryKey or legacy lowercase ID
 * @returns Category configuration for UI rendering
 */
export function getCategoryConfig(categoryId: string): CategoryConfig {
  // Handle legacy lowercase IDs
  let key: CategoryKey;
  if (categoryId === categoryId.toUpperCase() && categoryId in CATEGORY_DISPLAY_MAP) {
    key = categoryId as CategoryKey;
  } else {
    key = legacyIdToKey(categoryId);
  }
  
  const config = getConfig(key, 'nl'); // Default to Dutch
  
  return {
    id: key,
    label: config.label,
    dotClass: config.dotClass,
    bgClass: config.bgClass,
    textClass: config.textClass,
    borderClass: config.borderClass
  };
}

/**
 * All categories as CategoryConfig array (for UI lists)
 */
export const CATEGORIES: CategoryConfig[] = [
  'ACTIVE',
  'MUSIC',
  'CULTURE',
  'SOCIAL',
  'FAMILY',
  'FOOD',
  'NIGHTLIFE',
  'CIVIC',
  'COMMUNITY'
].map(key => getCategoryConfig(key));

/**
 * Legacy mapping for old category IDs to new keys
 * @deprecated Use legacyIdToKey from localization instead
 */
export const CATEGORY_MAP: Record<string, string> = {
  'sports': 'ACTIVE',
  'cinema': 'CULTURE',
  'arts': 'CULTURE',
  'market': 'FOOD',
  'crafts': 'CULTURE',
  'nightlife': 'NIGHTLIFE',
  'wellness': 'ACTIVE',
  'music': 'MUSIC',
  'active': 'ACTIVE',
  'entertainment': 'CULTURE',
  'social': 'SOCIAL',
  'family': 'FAMILY',
  'outdoors': 'ACTIVE',
  'workshops': 'CULTURE',
  'foodie': 'FOOD',
  'gaming': 'CULTURE',
  'community': 'COMMUNITY'
};

