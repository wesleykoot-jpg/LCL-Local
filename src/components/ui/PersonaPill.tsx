import { motion } from 'framer-motion';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { cn } from '@/lib/utils';

interface PersonaPillProps {
  /**
   * The persona label to display
   */
  label: string;
  /**
   * Optional stagger index for entrance animation
   */
  index?: number;
  /**
   * Optional className for custom styling
   */
  className?: string;
  /**
   * Optional variant for different styles
   */
  variant?: 'default' | 'glass' | 'solid';
  /**
   * Optional size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PersonaPill - Reusable persona badge component
 * 
 * A pill-shaped badge that displays a persona or interest label.
 * Supports animations, multiple variants, and automatic reduced motion handling.
 * 
 * @example
 * <PersonaPill label="Foodie" variant="glass" index={0} />
 * <PersonaPill label="Nightlife" variant="solid" />
 */
export function PersonaPill({
  label,
  index = 0,
  className,
  variant = 'glass',
  size = 'md',
}: PersonaPillProps) {
  const motionPreset = useMotionPreset();

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  const variantClasses = {
    default: 'bg-white/10 border border-white/20 text-white',
    glass: 'bg-white/20 backdrop-blur-sm border border-white/30 text-white',
    solid: 'bg-primary text-primary-foreground border-0',
  };

  return (
    <motion.div
      className={cn(
        'rounded-full font-medium',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...motionPreset.staggerChildren(index, 0.1)}
    >
      {label}
    </motion.div>
  );
}
