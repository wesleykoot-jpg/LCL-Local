import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { cn } from '@/lib/utils';

interface HeroCardProps {
  /**
   * Card content
   */
  children: ReactNode;
  /**
   * Optional className for custom styling
   */
  className?: string;
  /**
   * Aspect ratio of the card (default: credit card ratio 1.58:1)
   */
  aspectRatio?: string;
  /**
   * Enable holographic sheen effect
   */
  holographic?: boolean;
  /**
   * Enable glass morphism background
   */
  glass?: boolean;
}

/**
 * HeroCard - Reusable glass card component
 * 
 * A versatile card component with optional holographic effects and glass morphism.
 * Based on the IdentityCard design, extracted for reuse across the app.
 * 
 * @example
 * <HeroCard glass holographic>
 *   <div className="p-6">Content here</div>
 * </HeroCard>
 */
export function HeroCard({
  children,
  className,
  aspectRatio = '1.58 / 1',
  holographic = false,
  glass = true,
}: HeroCardProps) {
  const motionPreset = useMotionPreset();

  return (
    <motion.div
      className={cn(
        'relative w-full rounded-2xl overflow-hidden shadow-2xl',
        className
      )}
      style={{ aspectRatio }}
      {...motionPreset.scale}
    >
      {/* Glass Background */}
      {glass && (
        <div className="absolute inset-0 bg-gray-100 border border-gray-300" />
      )}

      {/* Holographic Foil Animation - Sweeps every 5 seconds */}
      {holographic && !motionPreset.prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Card Content */}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}
