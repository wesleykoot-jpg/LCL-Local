import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionPreset } from '@/shared/hooks/useMotionPreset';

export interface HeroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Enable 3D tilt effect (requires tilt values)
   */
  enableTilt?: boolean;
  /**
   * Tilt values for 3D effect
   */
  tilt?: {
    tiltX: number;
    tiltY: number;
    glintOpacity: number;
  };
  /**
   * Aspect ratio (default: credit card ratio 1.58:1)
   */
  aspectRatio?: string;
  /**
   * Enable holographic sheen effect
   */
  enableHolographicSheen?: boolean;
  /**
   * Enable foil sweep animation
   */
  enableFoilAnimation?: boolean;
}

/**
 * HeroCard - Premium Glass Card with 3D Effects
 * 
 * A premium card component with glass morphism, optional 3D tilt,
 * holographic sheen, and foil sweep animations. Perfect for identity
 * cards, featured content, or hero sections.
 * 
 * @example
 * ```tsx
 * <HeroCard>
 *   <div>Content here</div>
 * </HeroCard>
 * 
 * // With 3D tilt
 * <HeroCard enableTilt tilt={tiltValues}>
 *   <div>Content here</div>
 * </HeroCard>
 * ```
 */
export const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  (
    {
      children,
      className,
      enableTilt = false,
      tilt = { tiltX: 0, tiltY: 0, glintOpacity: 0 },
      aspectRatio = '1.58 / 1',
      enableHolographicSheen = true,
      enableFoilAnimation = true,
      ...props
    },
    ref
  ) => {
    const { scaleIn, prefersReducedMotion } = useMotionPreset();

    // Calculate holographic sheen position (opposite to tilt)
    const sheenX = -tilt.tiltX * 2;
    const sheenY = -tilt.tiltY * 2;

    return (
      <div
        className="w-full"
        style={{
          perspective: enableTilt && !prefersReducedMotion ? '1000px' : 'none',
        }}
      >
        <motion.div
          ref={ref}
          className={cn(
            'relative w-full rounded-2xl overflow-hidden shadow-2xl',
            className
          )}
          style={{
            aspectRatio,
            transform:
              enableTilt && !prefersReducedMotion
                ? `rotateY(${tilt.tiltX * 0.5}deg) rotateX(${-tilt.tiltY * 0.5}deg)`
                : 'none',
          }}
          {...scaleIn()}
          {...props}
        >
          {/* Glass Background */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl border border-white/20" />

          {/* Holographic Sheen Overlay */}
          {enableHolographicSheen && !prefersReducedMotion && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(${135 + sheenX + sheenY}deg, 
                  rgba(255, 255, 255, 0) 0%, 
                  rgba(255, 255, 255, 0.3) 45%, 
                  rgba(255, 255, 255, 0.3) 55%, 
                  rgba(255, 255, 255, 0) 100%)`,
                opacity: tilt.glintOpacity,
                transition: 'opacity 0.15s ease-out',
              }}
            />
          )}

          {/* Holographic Foil Animation - Sweeps every 5 seconds */}
          {enableFoilAnimation && !prefersReducedMotion && (
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
      </div>
    );
  }
);

HeroCard.displayName = 'HeroCard';
