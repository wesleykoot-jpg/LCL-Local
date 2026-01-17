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
 * LCL Core v5.0 "Social Air" Design System:
 * - Section headers: text-xl font-bold tracking-tight
 * - Primary color: Social Indigo (#6366F1)
 * - Left/Right padding: px-6 (24px)
 * - Between sections: mb-6 (24px) gap handled by parent
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
        <div className="flex items-center justify-between px-6 mb-6">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-[14px] font-semibold text-brand-primary hover:text-brand-secondary active:opacity-70 min-h-[44px] px-2 flex items-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary focus-visible:outline-none"
              aria-label="See all items in this section"
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
