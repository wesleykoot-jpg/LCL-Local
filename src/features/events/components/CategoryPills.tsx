import { useRef } from 'react';
import { motion } from 'framer-motion';
import { hapticImpact } from '@/shared/lib/haptics';
import {
    Music, Utensils, Waves, Gamepad2,
    Palette, Users, Tent, Trophy,
    Sparkles, Coffee
} from 'lucide-react';

interface CategoryPillsProps {
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
}

const CATEGORIES = [
    { id: 'music', label: 'Music', icon: Music, color: 'text-pink-500' },
    { id: 'foodie', label: 'Food & Drink', icon: Utensils, color: 'text-orange-500' },
    { id: 'social', label: 'Social', icon: Users, color: 'text-indigo-500' },
    { id: 'active', label: 'Sports', icon: Trophy, color: 'text-emerald-500' },
    { id: 'entertainment', label: 'Fun', icon: Sparkles, color: 'text-purple-500' },
    { id: 'workshops', label: 'Create', icon: Palette, color: 'text-blue-500' },
    { id: 'outdoors', label: 'Outdoors', icon: Tent, color: 'text-green-600' },
    { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: 'text-violet-500' },
    { id: 'wellness', label: 'Wellness', icon: Waves, color: 'text-cyan-500' },
];

export const CategoryPills = ({ selectedCategory, onSelectCategory }: CategoryPillsProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSelect = (id: string) => {
        hapticImpact('light');
        if (selectedCategory === id) {
            onSelectCategory(null); // Toggle off
        } else {
            onSelectCategory(id);
        }
    };

    return (
        <div
            className="flex overflow-x-auto gap-2 px-6 pb-2 -mx-0 scrollbar-hide snap-x"
            ref={containerRef}
        >
            {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const Icon = cat.icon;

                return (
                    <motion.button
                        key={cat.id}
                        onClick={() => handleSelect(cat.id)}
                        className={`
              flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all whitespace-nowrap snap-start border
              ${isSelected
                                ? 'bg-brand-primary text-white border-brand-primary shadow-apple-sm'
                                : 'bg-white text-text-secondary border-border hover:border-brand-primary/30 hover:bg-surface-base'
                            }
            `}
                        whileTap={{ scale: 0.96 }}
                    >
                        <Icon size={14} className={isSelected ? 'text-white' : cat.color} />
                        {cat.label}
                    </motion.button>
                );
            })}
        </div>
    );
};
