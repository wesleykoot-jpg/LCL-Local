export interface CategoryConfig {
  id: string;
  label: string;
  // Color classes using Tailwind 500 scale - Premium Muted palette
  dotClass: string;      // The color dot
  bgClass: string;       // Badge background (10% opacity)
  textClass: string;     // Badge text (300 shade for readability)
  borderClass: string;   // Badge border (20% opacity)
  accentBorder: string;  // Left accent border for cards
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'active',
    label: 'Active',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-500',
    borderClass: 'border-orange-500/20',
    accentBorder: 'border-l-orange-500',
  },
  {
    id: 'gaming',
    label: 'Gaming',
    dotClass: 'bg-violet-500',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-500',
    borderClass: 'border-violet-500/20',
    accentBorder: 'border-l-violet-500',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    dotClass: 'bg-rose-500',
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-500',
    borderClass: 'border-rose-500/20',
    accentBorder: 'border-l-rose-500',
  },
  {
    id: 'social',
    label: 'Social',
    dotClass: 'bg-blue-500',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500/20',
    accentBorder: 'border-l-blue-500',
  },
  {
    id: 'family',
    label: 'Family',
    dotClass: 'bg-teal-500',
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-500',
    borderClass: 'border-teal-500/20',
    accentBorder: 'border-l-teal-500',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/20',
    accentBorder: 'border-l-emerald-500',
  },
  {
    id: 'music',
    label: 'Music',
    dotClass: 'bg-indigo-500',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-500',
    borderClass: 'border-indigo-500/20',
    accentBorder: 'border-l-indigo-500',
  },
  {
    id: 'workshops',
    label: 'Workshops',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-500',
    borderClass: 'border-amber-500/20',
    accentBorder: 'border-l-amber-500',
  },
  {
    id: 'foodie',
    label: 'Foodie',
    dotClass: 'bg-pink-500',
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-500',
    borderClass: 'border-pink-500/20',
    accentBorder: 'border-l-pink-500',
  },
  {
    id: 'community',
    label: 'Community',
    dotClass: 'bg-slate-500',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-500',
    borderClass: 'border-slate-500/20',
    accentBorder: 'border-l-slate-500',
  },
];

// Map old/legacy categories to new ones
export const CATEGORY_MAP: Record<string, string> = {
  sports: 'active',
  cinema: 'entertainment',
  arts: 'entertainment',
  market: 'community',
  crafts: 'workshops',
  nightlife: 'music',
  wellness: 'active',
};

export function getCategoryConfig(categoryId: string): CategoryConfig {
  const mapped = CATEGORY_MAP[categoryId] || categoryId;
  return CATEGORIES.find(c => c.id === mapped) || CATEGORIES[0];
}
