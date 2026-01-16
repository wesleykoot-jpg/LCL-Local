import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { hapticSelection } from '@/shared/lib/haptics';

interface TimeDialProps {
  /** Current time offset in minutes (0-240) */
  value: number;
  /** Callback when value changes */
  onChange: (minutes: number) => void;
  /** Callback when user starts dragging */
  onDragStart?: () => void;
  /** Callback when user stops dragging */
  onDragEnd?: () => void;
}

// Time marks for the dial (every 15 minutes)
const TIME_MARKS = [0, 15, 30, 45, 60, 90, 120, 180, 240];

// Labels for display
const getTimeLabel = (minutes: number): string => {
  if (minutes === 0) return 'Live';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * Kinetic Time-Dial
 * 
 * A tactile, semi-circular "tuner" that filters the future.
 * - Glass arc at the top of the screen
 * - Draggable knob that snaps to 15-minute grid points
 * - Range: Live (0m) to Late Night (+4h)
 * - Haptic feedback on every 15-minute tick
 * - Background gradient shifts from Neon Orange (Now) → Deep Purple (Later)
 */
export const TimeDial = memo(function TimeDial({
  value,
  onChange,
  onDragStart,
  onDragEnd,
}: TimeDialProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastSnapRef = useRef(value);
  
  // Motion values for smooth animation
  const x = useMotionValue(0);
  const progress = useMotionValue(value / 240);
  
  // Calculate progress from value
  useEffect(() => {
    if (!isDragging) {
      progress.set(value / 240);
    }
  }, [value, isDragging, progress]);

  // Transform progress to gradient color
  // Neon Orange (#FF6B2C) at 0 → Deep Purple (#6B46C1) at 1
  const backgroundColor = useTransform(
    progress,
    [0, 0.5, 1],
    [
      'linear-gradient(135deg, #FF6B2C 0%, #FF8F50 100%)',
      'linear-gradient(135deg, #C850C0 0%, #8E44AD 100%)',
      'linear-gradient(135deg, #6B46C1 0%, #4C1D95 100%)',
    ]
  );

  // Handle drag
  const handleDrag = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
    
    // Calculate minutes based on position
    const rawMinutes = percentage * 240;
    
    // Snap to nearest 15-minute mark
    const snappedMinutes = Math.round(rawMinutes / 15) * 15;
    const clampedMinutes = Math.max(0, Math.min(240, snappedMinutes));
    
    // Update progress for visual feedback
    progress.set(clampedMinutes / 240);
    
    // Trigger haptic on snap change
    if (clampedMinutes !== lastSnapRef.current) {
      lastSnapRef.current = clampedMinutes;
      hapticSelection();
      onChange(clampedMinutes);
    }
  }, [onChange, progress]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    onDragStart?.();
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    onDragEnd?.();
  }, [onDragEnd]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    handleDragStart();
    handleDrag(e.clientX);
    
    const handleMove = (e: PointerEvent) => handleDrag(e.clientX);
    const handleUp = () => {
      handleDragEnd();
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [handleDrag, handleDragStart, handleDragEnd]);

  return (
    <div className="w-full px-4 pt-4 pb-2">
      {/* Glass Arc Container */}
      <motion.div
        ref={containerRef}
        className="relative h-20 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          background: backgroundColor,
        }}
        onPointerDown={handlePointerDown}
      >
        {/* Glass overlay */}
        <div 
          className="absolute inset-0 bg-white/10 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)',
          }}
        />
        
        {/* Time marks */}
        <div className="absolute inset-x-0 top-2 flex justify-between px-4">
          {TIME_MARKS.map((mark) => {
            const isActive = value >= mark;
            return (
              <div
                key={mark}
                className={`flex flex-col items-center transition-opacity duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div 
                  className={`w-1 h-3 rounded-full ${
                    mark === value ? 'bg-white scale-125' : 'bg-white/60'
                  } transition-all duration-150`}
                />
                <span className={`text-[10px] font-medium mt-1 ${
                  mark === value ? 'text-white' : 'text-white/70'
                }`}>
                  {getTimeLabel(mark)}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Draggable Knob */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-12 h-12"
          style={{
            left: `calc(${(value / 240) * 100}% - 24px)`,
          }}
          animate={{ left: `calc(${(value / 240) * 100}% - 24px)` }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div 
            className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.3)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-orange-400 to-purple-600" />
          </div>
        </motion.div>
        
        {/* Current time label */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <span className="text-white font-bold text-lg drop-shadow-lg">
            {getTimeLabel(value)}
          </span>
        </div>
      </motion.div>
    </div>
  );
});
