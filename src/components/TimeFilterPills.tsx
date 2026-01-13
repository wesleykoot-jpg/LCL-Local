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
    <div className="relative">
      <div 
        className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-[1.5rem] border-[0.5px] border-border/20 overflow-x-auto scrollbar-hide"
        style={{
          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.04)'
        }}
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleFilterChange(filter.id)}
              className={cn(
                'relative px-4 py-3 min-h-[48px] text-[15px] font-semibold rounded-[1.25rem] transition-all duration-200 whitespace-nowrap shrink-0',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'active:scale-[0.97]',
                isActive
                  ? 'text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {/* Animated background pill - Squircle */}
              {isActive && (
                <motion.div
                  layoutId="activeTimeFilterPill"
                  className="absolute inset-0 bg-foreground rounded-[1.25rem]"
                  style={{
                    boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.15)'
                  }}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-10 tracking-tight">{filter.label}</span>
            </button>
          );
        })}
      </div>
      {/* Right fade indicator for scroll */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none rounded-r-[1.5rem]"
        aria-hidden="true"
      />
    </div>
  );
});
