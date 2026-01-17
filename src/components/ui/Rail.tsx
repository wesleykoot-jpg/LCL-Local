import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { cn } from '@/lib/utils';

interface RailProps {
  /**
   * Section title
   */
  title?: ReactNode;
  /**
   * Rail content (usually horizontal scrolling cards)
   */
  children: ReactNode;
  /**
   * Optional "See all" callback
   */
  onSeeAll?: () => void;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

/**
 * Rail - Horizontal scrolling section wrapper
 * 
 * A reusable component for creating horizontal scrolling sections
 * with consistent headers and spacing. Based on DiscoveryRail but
 * extracted as a generic primitive.
 * 
 * @example
 * <Rail title="Popular Events" onSeeAll={() => navigate('/events')}>
 *   <div className="flex gap-4">
 *     <EventCard />
 *     <EventCard />
 *   </div>
 * </Rail>
 */
export const Rail = memo(function Rail({
  title,
  children,
  onSeeAll,
  className,
}: RailProps) {
  const motionPreset = useMotionPreset();

  return (
    <motion.section
      className={cn('overflow-x-visible', className)}
      {...motionPreset.slideUp}
    >
      {/* Section Header */}
      {title && (
        <div className="flex items-center justify-between px-6 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-[14px] font-medium text-foreground hover:underline active:opacity-70 min-h-[44px] px-2 flex items-center"
              aria-label="See all items"
            >
              See all
            </button>
          )}
        </div>
      )}

      {/* Content - Horizontal scroll container */}
      <div className="px-6 -mx-6">
        <div className="px-6">{children}</div>
      </div>
    </motion.section>
  );
});
