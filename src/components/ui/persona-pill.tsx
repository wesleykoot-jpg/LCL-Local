import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionPreset } from '@/shared/hooks/useMotionPreset';

export interface PersonaPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The persona label to display
   */
  label: string;
  /**
   * Optional animation delay index (for stagger effects)
   */
  animationIndex?: number;
  /**
   * Variant style
   */
  variant?: 'default' | 'primary' | 'secondary';
}

/**
 * PersonaPill - Display persona/interest tags
 * 
 * A styled pill component for displaying persona types, interests,
 * or category badges with optional stagger animations.
 * 
 * @example
 * ```tsx
 * <PersonaPill label="Foodie" />
 * <PersonaPill label="Art Lover" variant="primary" />
 * <PersonaPill label="Nightlife" animationIndex={0} />
 * ```
 */
export const PersonaPill = React.forwardRef<HTMLDivElement, PersonaPillProps>(
  ({ label, animationIndex, variant = 'default', className, ...props }, ref) => {
    const { slideUp, prefersReducedMotion } = useMotionPreset();

    const variantStyles = {
      default: 'bg-white/20 backdrop-blur-sm border-white/30 text-white',
      primary: 'bg-primary/20 backdrop-blur-sm border-primary/30 text-primary',
      secondary: 'bg-secondary/20 backdrop-blur-sm border-secondary/30 text-secondary',
    };

    const MotionDiv = motion.div;

    return (
      <MotionDiv
        ref={ref}
        className={cn(
          'px-3 py-1.5 rounded-full border text-xs font-medium',
          variantStyles[variant],
          className
        )}
        {...(animationIndex !== undefined && !prefersReducedMotion
          ? slideUp({ delay: 0.2 + animationIndex * 0.1 })
          : {})}
        {...props}
      >
        {label}
      </MotionDiv>
    );
  }
);

PersonaPill.displayName = 'PersonaPill';
