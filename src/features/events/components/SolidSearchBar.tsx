import { memo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { hapticImpact } from '@/shared/lib/haptics';

interface SolidSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onCancel?: () => void;
  mode: 'browsing' | 'searching';
  placeholder?: string;
}

/**
 * SolidSearchBar - Smart search bar for Discovery page
 * 
 * LCL v6.0 "Liquid Solid" Design System:
 * - Height: h-14 (56px)
 * - Shape: rounded-pill
 * - Shadow: shadow-card
 * 
 * Interaction:
 * - Browsing: Solid muted background
 * - Searching: Solid white background + "Cancel" text button
 */
export const SolidSearchBar = memo(function SolidSearchBar({
  value,
  onChange,
  onFocus,
  onCancel,
  mode,
  placeholder = 'Search events...',
}: SolidSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = useCallback(async () => {
    await hapticImpact('light');
    onFocus?.();
  }, [onFocus]);

  const handleCancel = useCallback(async () => {
    await hapticImpact('light');
    inputRef.current?.blur();
    onCancel?.();
  }, [onCancel]);

  const handleClear = useCallback(async () => {
    await hapticImpact('light');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const isSearching = mode === 'searching';

  return (
    <motion.div 
      className="flex items-center gap-3"
    >
      <motion.div
        className={`
          flex-1 flex items-center gap-3 h-14 rounded-pill px-5
          transition-all duration-200
          ${isSearching 
            ? 'bg-white border border-border shadow-card' 
            : 'bg-white border border-border shadow-card'
          }
        `}
        layout
      >
        <Search 
          size={20} 
          className="text-text-secondary flex-shrink-0"
          strokeWidth={2}
        />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`
            flex-1 bg-transparent outline-none text-[16px] text-text-primary placeholder:text-text-muted
            min-w-0
          `}
        />

        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 active:scale-95 transition-colors"
          >
            <X size={14} className="text-text-secondary" />
          </motion.button>
        )}
      </motion.div>

      {/* Cancel button - only visible in searching mode */}
      <motion.button
        initial={false}
        animate={{
          width: isSearching ? 'auto' : 0,
          opacity: isSearching ? 1 : 0,
          marginLeft: isSearching ? 0 : -12,
        }}
        transition={{ duration: 0.2 }}
        onClick={handleCancel}
        className="text-[16px] font-medium text-brand-primary whitespace-nowrap overflow-hidden min-h-[44px] flex items-center active:opacity-70"
      >
        Cancel
      </motion.button>
    </motion.div>
  );
});
