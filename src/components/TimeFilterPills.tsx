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
  { id: 'weekend', label: 'This Weekend' },
];

export const TimeFilterPills = memo(function TimeFilterPills({
  activeFilter,
  onFilterChange,
}: TimeFilterPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-1">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <motion.button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            )}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            {filter.label}
          </motion.button>
        );
      })}
    </div>
  );
});
