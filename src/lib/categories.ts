export interface CategoryConfig {
  id: string;
  label: string;
  // Color classes using Tailwind 500 scale - Premium Muted palette
  dotClass: string;      // The color dot
  bgClass: string;       // Badge background (10% opacity)
  textClass: string;     // Badge text (300 shade for readability)
  borderClass: string;   // Badge border (20% opacity)
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'active',
    label: 'Active',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-300',
    borderClass: 'border-orange-500/20',
  },
  {
    id: 'gaming',
    label: 'Gaming',
    dotClass: 'bg-violet-500',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-300',
    borderClass: 'border-violet-500/20',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    dotClass: 'bg-rose-500',
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/20',
  },
  {
    id: 'social',
    label: 'Social',
    dotClass: 'bg-blue-500',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/20',
  },
  {
    id: 'family',
    label: 'Family',
    dotClass: 'bg-teal-500',
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-300',
    borderClass: 'border-teal-500/20',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/20',
  },
  {
    id: 'music',
    label: 'Music',
    dotClass: 'bg-indigo-500',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-300',
    borderClass: 'border-indigo-500/20',
  },
  {
    id: 'workshops',
    label: 'Workshops',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/20',
  },
  {
    id: 'foodie',
    label: 'Foodie',
    dotClass: 'bg-pink-500',
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-300',
    borderClass: 'border-pink-500/20',
  },
  {
    id: 'community',
    label: 'Community',
    dotClass: 'bg-slate-500',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-500/20',
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
