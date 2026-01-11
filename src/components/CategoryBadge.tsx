import { memo } from 'react';
import { getCategoryConfig } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export const CategoryBadge = memo(function CategoryBadge({ 
  category, 
  className 
}: CategoryBadgeProps) {
  const config = getCategoryConfig(category);
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <Icon size={12} />
      <span>{config.label}</span>
    </div>
  );
});
