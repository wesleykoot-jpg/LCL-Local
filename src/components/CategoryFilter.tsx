import { memo } from 'react';
import { CATEGORIES, type CategoryConfig } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  selectedCategories: string[];
  onToggle: (categoryId: string) => void;
  className?: string;
}

/**
 * Horizontal scroll filter bar with "Dot + Label" pattern.
 * Inactive: muted styling with 50% opacity dot
 * Active: white bg with full color dot
 */
export const CategoryFilter = memo(function CategoryFilter({
  selectedCategories,
  onToggle,
  className,
}: CategoryFilterProps) {
  const allSelected = selectedCategories.length === 0;

  return (
    <div className={cn('overflow-x-auto scrollbar-hide', className)}>
      <div className="flex gap-2 pb-1 px-1">
        {/* "All" pill */}
        <button
          onClick={() => {
            // Clear all selections to show "All"
            if (!allSelected) {
              selectedCategories.forEach(cat => onToggle(cat));
            }
          }}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full',
            'text-sm font-medium transition-all whitespace-nowrap',
            'border',
            allSelected
              ? 'bg-white text-zinc-900 border-white'
              : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full bg-gradient-to-br from-orange-400 via-violet-400 to-emerald-400',
              allSelected ? 'opacity-100' : 'opacity-50'
            )}
          />
          <span>All</span>
        </button>

        {/* Category pills */}
        {CATEGORIES.map((cat: CategoryConfig) => {
          const isActive = selectedCategories.includes(cat.id);
          
          return (
            <button
              key={cat.id}
              onClick={() => onToggle(cat.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full',
                'text-sm font-medium transition-all whitespace-nowrap',
                'border',
                isActive
                  ? 'bg-white text-zinc-900 border-white'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  cat.dotClass,
                  isActive ? 'opacity-100' : 'opacity-50'
                )}
              />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
