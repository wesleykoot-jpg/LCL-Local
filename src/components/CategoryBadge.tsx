import { memo } from 'react';
import { getCategoryConfig } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: string;
  className?: string;
  variant?: 'default' | 'glass';
  size?: 'sm' | 'md';
}

/**
 * Subtle tint badge with color-coded styling.
 * No icons - uses color as the primary identifier.
 * Typography: Uppercase, smaller tracking.
 */
export const CategoryBadge = memo(function CategoryBadge({ 
  category, 
  className,
  variant = 'default',
  size = 'md',
}: CategoryBadgeProps) {
  const config = getCategoryConfig(category);

  return (
    <span 
      className={cn(
        'inline-flex items-center rounded-full',
        'font-semibold uppercase tracking-wide',
        'border',
        // Size variants
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        // Style variants
        variant === 'glass' 
          ? 'bg-black/40 backdrop-blur-sm text-white border-white/20' 
          : cn(config.bgClass, config.textClass, config.borderClass),
        className
      )}
    >
      {config.label}
    </span>
  );
});
