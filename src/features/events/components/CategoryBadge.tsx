import { memo } from 'react';
import { getCategoryConfig } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/utils';

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
        // Size variants - standardized for consistency
        size === 'sm' ? 'px-2 py-0.5 text-[11px] h-6' : 'px-3 py-1 text-[12px] h-8',
        // Style variants
        variant === 'glass' 
          ? 'bg-gray-900  text-white border-gray-300' 
          : cn(config.bgClass, config.textClass, config.borderClass),
        className
      )}
    >
      {config.label}
    </span>
  );
});