import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type TimeFilter = 'all' | 'tonight' | 'tomorrow' | 'weekend';

interface TimeFilterPillsProps {
  activeFilter: TimeFilter;
  onFilterChange: (filter: TimeFilter) => void;
}

const FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'Weekend' },
];

export const TimeFilterPills = memo(function TimeFilterPills({
  activeFilter,
  onFilterChange,
}: TimeFilterPillsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-full w-fit">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {/* Animated background pill */}
            {isActive && (
              <motion.div
                layoutId="activeTimeFilterPill"
                className="absolute inset-0 bg-foreground rounded-full"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-10">{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
});
