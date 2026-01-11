import { memo } from 'react';
import { motion } from 'framer-motion';
import { Compass, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'pulse' | 'tribe';

interface PulseTribeToggleProps {
  activeMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const PulseTribeToggle = memo(function PulseTribeToggle({
  activeMode,
  onChange,
}: PulseTribeToggleProps) {
  return (
    <div className="tab-toggle">
      <motion.button
        onClick={() => onChange('pulse')}
        className={cn('tab-toggle-item flex items-center gap-2')}
        data-active={activeMode === 'pulse'}
        whileTap={{ scale: 0.97 }}
      >
        <Compass size={16} />
        <span>Local Pulse</span>
      </motion.button>
      
      <motion.button
        onClick={() => onChange('tribe')}
        className={cn('tab-toggle-item flex items-center gap-2')}
        data-active={activeMode === 'tribe'}
        whileTap={{ scale: 0.97 }}
      >
        <Users size={16} />
        <span>My Tribe</span>
      </motion.button>
    </div>
  );
});