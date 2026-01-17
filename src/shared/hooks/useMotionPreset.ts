import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

/**
 * Motion Presets Hook
 * 
 * Provides consistent motion presets across the app that respect
 * user's reduced motion preference.
 * 
 * @example
 * ```tsx
 * const { fadeIn, slideUp, scaleIn } = useMotionPreset();
 * 
 * <motion.div {...fadeIn}>Content</motion.div>
 * <motion.div {...slideUp(0.2)}>Delayed content</motion.div>
 * ```
 */

export interface MotionPresetOptions {
  delay?: number;
  duration?: number;
}

export interface MotionPreset {
  initial: Record<string, any> | false;
  animate: Record<string, any>;
  exit?: Record<string, any>;
  transition?: Record<string, any>;
}

export function useMotionPreset() {
  const prefersReducedMotion = useReducedMotion();

  const presets = useMemo(() => {
    // If user prefers reduced motion, return minimal/no animations
    if (prefersReducedMotion) {
      return {
        fadeIn: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1 },
        }),
        slideUp: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1, y: 0 },
        }),
        slideDown: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1, y: 0 },
        }),
        slideLeft: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1, x: 0 },
        }),
        slideRight: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1, x: 0 },
        }),
        scaleIn: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1, scale: 1 },
        }),
        staggerChildren: (options: MotionPresetOptions = {}): MotionPreset => ({
          initial: false,
          animate: { opacity: 1 },
        }),
        prefersReducedMotion: true,
      };
    }

    // Full animations for users without reduced motion preference
    return {
      fadeIn: ({ delay = 0, duration = 0.3 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration, delay },
      }),
      slideUp: ({ delay = 0, duration = 0.4 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration, delay },
      }),
      slideDown: ({ delay = 0, duration = 0.4 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 20 },
        transition: { duration, delay },
      }),
      slideLeft: ({ delay = 0, duration = 0.3 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 },
        transition: { duration, delay },
      }),
      slideRight: ({ delay = 0, duration = 0.3 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { duration, delay },
      }),
      scaleIn: ({ delay = 0, duration = 0.3 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.8 },
        transition: { type: 'spring', damping: 15, delay },
      }),
      staggerChildren: ({ delay = 0, duration = 0.05 }: MotionPresetOptions = {}): MotionPreset => ({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: {
          staggerChildren: duration,
          delayChildren: delay,
        },
      }),
      prefersReducedMotion: false,
    };
  }, [prefersReducedMotion]);

  return presets;
}
