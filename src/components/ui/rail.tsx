import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionPreset } from '@/shared/hooks/useMotionPreset';

export interface RailProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Rail title/heading
   */
  title?: string;
  /**
   * Optional subtitle or description
   */
  subtitle?: string;
  /**
   * Enable horizontal scrolling
   */
  scrollable?: boolean;
  /**
   * Animation delay
   */
  animationDelay?: number;
}

/**
 * Rail - Horizontal Content Container
 * 
 * A container component for displaying horizontal rows of content,
 * commonly used for carousels, card lists, or grouped items.
 * Supports optional scrolling and stagger animations.
 * 
 * @example
 * ```tsx
 * <Rail title="Featured Events" scrollable>
 *   <EventCard />
 *   <EventCard />
 *   <EventCard />
 * </Rail>
 * 
 * <Rail title="Categories" subtitle="Browse by interest">
 *   {categories.map(cat => <CategoryCard key={cat.id} {...cat} />)}
 * </Rail>
 * ```
 */
export const Rail = React.forwardRef<HTMLDivElement, RailProps>(
  (
    {
      title,
      subtitle,
      scrollable = false,
      animationDelay = 0,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const { slideUp } = useMotionPreset();

    return (
      <motion.div
        ref={ref}
        className={cn('w-full', className)}
        {...slideUp({ delay: animationDelay })}
        {...props}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-4 px-5">
            {title && (
              <h2 className="text-xl font-bold text-foreground">{title}</h2>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Content Container */}
        <div
          className={cn(
            scrollable
              ? 'flex gap-4 overflow-x-auto scrollbar-hide px-5 pb-2'
              : 'flex flex-wrap gap-4 px-5',
            'snap-x snap-mandatory'
          )}
        >
          {children}
        </div>
      </motion.div>
    );
  }
);

Rail.displayName = 'Rail';

/**
 * RailItem - Individual Item within a Rail
 * 
 * Optional wrapper for rail items that provides consistent sizing
 * and snap-scroll behavior.
 */
export interface RailItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Item width (default: auto)
   */
  width?: string;
  /**
   * Enable snap-scroll for this item
   */
  snapScroll?: boolean;
}

export const RailItem = React.forwardRef<HTMLDivElement, RailItemProps>(
  ({ width = 'auto', snapScroll = true, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex-shrink-0',
          snapScroll && 'snap-start',
          className
        )}
        style={{ width }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

RailItem.displayName = 'RailItem';
