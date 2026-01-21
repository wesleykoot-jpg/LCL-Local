import { memo } from 'react';
import { motion } from 'framer-motion';
import { INTENT_CONFIGS, type MissionIntent } from '../types/discoveryTypes';
import { hapticImpact } from '@/shared/lib/haptics';

interface IntentPillsProps {
  onIntentSelect: (intent: MissionIntent) => void;
  selectedIntent?: MissionIntent | null;
  className?: string;
}

export const IntentPills = memo(function IntentPills({ 
  onIntentSelect, 
  selectedIntent,
  className = ''
}: IntentPillsProps) {
  const handleIntentClick = (intent: MissionIntent) => {
    hapticImpact('light');
    if (selectedIntent === intent) {
      // Allow deselecting if needed, though typically handled by parent
      onIntentSelect(intent); 
    } else {
      onIntentSelect(intent);
    }
  };

  return (
    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-4 ${className}`}>
      {Object.values(INTENT_CONFIGS).map((config) => {
        const isSelected = selectedIntent === config.intent;
        
        return (
          <motion.button
            key={config.intent}
            onClick={() => handleIntentClick(config.intent)}
            whileTap={{ scale: 0.95 }}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border
              ${isSelected 
                ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                : 'bg-card text-foreground border-border hover:border-primary/50 shadow-sm'
              }
            `}
          >
            <span className="text-base">{config.emoji}</span>
            <span>{config.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
});
