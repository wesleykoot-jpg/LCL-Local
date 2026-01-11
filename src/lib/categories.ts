import { 
  Trophy, 
  Gamepad2, 
  Baby, 
  Coffee, 
  Palette, 
  TreePine, 
  Moon, 
  Lightbulb, 
  Heart, 
  Users,
  type LucideIcon 
} from 'lucide-react';

export interface CategoryConfig {
  id: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
  bgClass: string;
  textClass: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'sports',
    label: 'Sports & Active',
    emoji: '⚽',
    icon: Trophy,
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-200',
  },
  {
    id: 'gaming',
    label: 'Gamers & Geeks',
    emoji: '🎮',
    icon: Gamepad2,
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-200',
  },
  {
    id: 'family',
    label: 'Family & Kids',
    emoji: '👶',
    icon: Baby,
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-200',
  },
  {
    id: 'social',
    label: 'Social & Dining',
    emoji: '🥂',
    icon: Coffee,
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-200',
  },
  {
    id: 'arts',
    label: 'Arts & Culture',
    emoji: '🎨',
    icon: Palette,
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-200',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    emoji: '🌳',
    icon: TreePine,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-200',
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    emoji: '🌙',
    icon: Moon,
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-200',
  },
  {
    id: 'workshops',
    label: 'Workshops',
    emoji: '🧠',
    icon: Lightbulb,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-200',
  },
  {
    id: 'wellness',
    label: 'Wellness',
    emoji: '🧘',
    icon: Heart,
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-200',
  },
  {
    id: 'community',
    label: 'Community',
    emoji: '🤝',
    icon: Users,
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-200',
  },
];

// Map old categories to new ones
export const CATEGORY_MAP: Record<string, string> = {
  cinema: 'arts',
  market: 'community',
  crafts: 'workshops',
  sports: 'sports',
  gaming: 'gaming',
};

export function getCategoryConfig(categoryId: string): CategoryConfig {
  const mapped = CATEGORY_MAP[categoryId] || categoryId;
  return CATEGORIES.find(c => c.id === mapped) || CATEGORIES[0];
}
