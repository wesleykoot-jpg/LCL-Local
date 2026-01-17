import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface DiscoveryRailProps {
  title: ReactNode;
  children: ReactNode;
  onSeeAll?: () => void;
}

/**
 * DiscoveryRail - Wrapper component for horizontal scrolling sections
 * 
 * Airbnb-style rail with:
 * - Section headers: text-2xl font-bold tracking-tight
 * - Left/Right padding: px-6 (24px)
 * - Between sections: mb-12 (48px) gap handled by parent
 */
export const DiscoveryRail = memo(function DiscoveryRail({
  title,
  children,
  onSeeAll,
}: DiscoveryRailProps) {
  return (
    <motion.section
      className="overflow-x-visible"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
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
            >
              See all
            </button>
          )}
        </div>
      )}

      {/* Content - Horizontal scroll container */}
      <div className="px-6 -mx-6">
        <div className="px-6">
          {children}
        </div>
      </div>
    </motion.section>
  );
});
