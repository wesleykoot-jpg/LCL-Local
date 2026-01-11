import { memo } from 'react';
import { getCategoryConfig } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

/**
 * Subtle tint badge with color-coded styling.
 * No icons - uses color as the primary identifier.
 * Typography: Uppercase, smaller tracking.
 */
export const CategoryBadge = memo(function CategoryBadge({ 
  category, 
  className 
}: CategoryBadgeProps) {
  const config = getCategoryConfig(category);

  return (
    <span 
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full',
        'text-xs font-semibold uppercase tracking-wide',
        'border',
        config.bgClass,
        config.textClass,
        config.borderClass,
        className
      )}
    >
      {config.label}
    </span>
  );
});
