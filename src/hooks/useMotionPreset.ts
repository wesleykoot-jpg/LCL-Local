import { useReducedMotion } from 'framer-motion';

/**
 * useMotionPreset - Centralized motion preferences hook
 * 
 * Returns motion-safe animation properties based on user's reduced motion preference.
 * Use this to ensure consistent motion behavior across the app.
 * 
 * @example
 * const motionPreset = useMotionPreset();
 * <motion.div initial={motionPreset.initial} animate={motionPreset.animate} />
 */
export function useMotionPreset() {
  const prefersReducedMotion = useReducedMotion();

  return {
    /**
     * Whether animations should be reduced/disabled
     */
    prefersReducedMotion,

    /**
     * Safe initial state for framer-motion
     * Returns false if reduced motion is preferred, otherwise the provided value
     */
    initial: (value: any) => (prefersReducedMotion ? false : value),

    /**
     * Common fade-in animation preset
     */
    fadeIn: prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.3 },
        },

    /**
     * Common slide-up animation preset
     */
    slideUp: prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3 },
        },

    /**
     * Common scale animation preset
     */
    scale: prefersReducedMotion
      ? {}
      : {
          initial: { scale: 0.9, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring', damping: 20, stiffness: 150 },
        },

    /**
     * Staggered children animation preset
     */
    staggerChildren: (index: number, delay = 0.1) =>
      prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: index * delay },
          },
  };
}
