export interface CategoryConfig {
  id: string;
  label: string;
  // Color classes using Tailwind 500 scale
  dotClass: string;      // The color dot
  bgClass: string;       // Badge background (10% opacity)
  textClass: string;     // Badge text
  borderClass: string;   // Badge border (20% opacity)
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'active',
    label: 'Active',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-600',
    borderClass: 'border-orange-500/20',
  },
  {
    id: 'gaming',
    label: 'Gaming',
    dotClass: 'bg-violet-500',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-600',
    borderClass: 'border-violet-500/20',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    dotClass: 'bg-rose-500',
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-600',
    borderClass: 'border-rose-500/20',
  },
  {
    id: 'social',
    label: 'Social',
    dotClass: 'bg-blue-500',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600',
    borderClass: 'border-blue-500/20',
  },
  {
    id: 'family',
    label: 'Family',
    dotClass: 'bg-teal-500',
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-600',
    borderClass: 'border-teal-500/20',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600',
    borderClass: 'border-emerald-500/20',
  },
  {
    id: 'music',
    label: 'Music',
    dotClass: 'bg-indigo-500',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-600',
    borderClass: 'border-indigo-500/20',
  },
  {
    id: 'workshops',
    label: 'Workshops',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600',
    borderClass: 'border-amber-500/20',
  },
  {
    id: 'foodie',
    label: 'Foodie',
    dotClass: 'bg-pink-500',
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-600',
    borderClass: 'border-pink-500/20',
  },
  {
    id: 'community',
    label: 'Community',
    dotClass: 'bg-slate-500',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-500/20',
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    dotClass: 'bg-fuchsia-500',
    bgClass: 'bg-fuchsia-500/10',
    textClass: 'text-fuchsia-600',
    borderClass: 'border-fuchsia-500/20',
  },
];

// Map refinery (uppercase) and legacy categories to current IDs
export const CATEGORY_MAP: Record<string, string> = {
  // Refinery (Phase 3+)
  'MUSIC': 'music',
  'SOCIAL': 'social',
  'ACTIVE': 'active',
  'CULTURE': 'culture',
  'FOOD': 'foodie',
  'NIGHTLIFE': 'nightlife',
  'FAMILY': 'family',
  'CIVIC': 'community',
  'COMMUNITY': 'community',

  // Legacy/Other
  'sports': 'active',
  'cinema': 'entertainment',
  'arts': 'entertainment',
  'market': 'community',
  'crafts': 'workshops',
  'nightlife': 'nightlife',
  'wellness': 'active',
  'outdoors': 'active',
  'food': 'foodie',
};

/**
 * Categories where midnight (00:00) is a legitimate start time
 * These are typically nightlife, music, or entertainment events that genuinely start late
 */
export const MIDNIGHT_VALID_CATEGORIES = ['music', 'nightlife', 'entertainment'] as const;

/**
 * Check if a category legitimately uses midnight as a start time
 * @param category - The event category to check
 * @returns true if midnight is a valid start time for this category
 */
export function isMidnightValidCategory(category: string | undefined | null): boolean {
  if (!category) return false;
  return MIDNIGHT_VALID_CATEGORIES.includes(category.toLowerCase() as typeof MIDNIGHT_VALID_CATEGORIES[number]);
}

export function getCategoryConfig(categoryId: string): CategoryConfig {
  const mapped = CATEGORY_MAP[categoryId] || categoryId;
  return CATEGORIES.find(c => c.id === mapped) || CATEGORIES[0];
}
