import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/haptics';

export type TimeFilter = 'all' | 'tonight' | 'tomorrow' | 'weekend';

interface TimeFilterPillsProps {
  activeFilter: TimeFilter;
  onFilterChange: (filter: TimeFilter) => void;
}

const FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'all', label: 'Alles' },
  { id: 'tonight', label: 'Vanavond' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'weekend', label: 'Weekend' },
];

export const TimeFilterPills = memo(function TimeFilterPills({
  activeFilter,
  onFilterChange,
}: TimeFilterPillsProps) {
  const handleFilterChange = async (filter: TimeFilter) => {
    await hapticImpact('light');
    onFilterChange(filter);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-full w-fit">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            onClick={() => handleFilterChange(filter.id)}
            className={cn(
              'relative px-4 py-3 min-h-[44px] text-sm font-medium rounded-full transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'active:scale-[0.97]',
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
