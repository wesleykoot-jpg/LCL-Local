import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionPreset } from '@/shared/hooks/useMotionPreset';

export interface VibeEQProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of bars (default: 3)
   */
  barCount?: number;
  /**
   * Bar color (default: white/80)
   */
  barColor?: string;
}

/**
 * VibeEQ - Animated Waveform Component
 * 
 * Small animated bars that signify "Live Status" or activity.
 * Commonly used next to user names or profile indicators.
 * 
 * @example
 * ```tsx
 * <VibeEQ />
 * <VibeEQ barCount={4} barColor="text-primary" />
 * ```
 */
export const VibeEQ = React.forwardRef<HTMLDivElement, VibeEQProps>(
  ({ barCount = 3, barColor = 'bg-white/80', className, ...props }, ref) => {
    const { prefersReducedMotion } = useMotionPreset();

    // If user prefers reduced motion, show static bars
    if (prefersReducedMotion) {
      return (
        <div
          ref={ref}
          className={cn('flex items-center gap-0.5 h-4', className)}
          aria-label="Active status"
          {...props}
        >
          {Array.from({ length: barCount }).map((_, i) => (
            <div
              key={i}
              className={cn('w-0.5 rounded-full', barColor)}
              style={{ height: '60%' }}
            />
          ))}
        </div>
      );
    }

    // Animated bars for users without reduced motion preference
    const barAnimations = [
      { heights: ['40%', '100%', '60%', '80%', '40%'], duration: 1.2, delay: 0 },
      { heights: ['80%', '40%', '100%', '50%', '80%'], duration: 1.4, delay: 0.1 },
      { heights: ['60%', '90%', '50%', '100%', '60%'], duration: 1.3, delay: 0.2 },
      { heights: ['70%', '50%', '90%', '60%', '70%'], duration: 1.5, delay: 0.15 },
    ];

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-0.5 h-4', className)}
        role="img"
        aria-label="Active status indicator"
        {...props}
      >
        {Array.from({ length: barCount }).map((_, i) => {
          const anim = barAnimations[i % barAnimations.length];
          return (
            <motion.div
              key={i}
              className={cn('w-0.5 rounded-full', barColor)}
              animate={{ height: anim.heights }}
              transition={{
                duration: anim.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: anim.delay,
              }}
            />
          );
        })}
      </div>
    );
  }
);

VibeEQ.displayName = 'VibeEQ';
