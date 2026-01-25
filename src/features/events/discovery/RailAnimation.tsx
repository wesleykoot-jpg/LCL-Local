/**
 * Rail Animation Component
 * 
 * Provides unique Framer Motion animations for each rail type:
 * - pulse: Breathing effect for Location rail
 * - rhythm: Clock-like for Rituals
 * - sparkle: Excitement for This Weekend
 * - glow: Ego validation for For You
 * - wave: Collective pulse
 */

import { memo } from "react";
import { motion, type Variants } from "framer-motion";
import type { RailAnimationStyle } from "./types";

interface RailAnimationProps {
  style: RailAnimationStyle;
  children: React.ReactNode;
  className?: string;
}

/**
 * Animation variants for each rail style
 */
const animationVariants: Record<RailAnimationStyle, Variants> = {
  // Breathing pulse for Location rail
  pulse: {
    initial: { opacity: 0.8, scale: 0.98 },
    animate: {
      opacity: [0.8, 1, 0.8],
      scale: [0.98, 1, 0.98],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
  
  // Clock-like rhythm for Rituals rail
  rhythm: {
    initial: { opacity: 0, x: -10 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  },
  
  // Sparkle excitement for This Weekend
  sparkle: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  },
  
  // Glowing validation for For You
  glow: {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  },
  
  // Wave effect for Pulse/Collective
  wave: {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  },
};

/**
 * Rail Animation Wrapper
 * Wraps rail content with appropriate animation based on style
 */
export const RailAnimation = memo(function RailAnimation({
  style,
  children,
  className = "",
}: RailAnimationProps) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={animationVariants[style]}
    >
      {children}
    </motion.div>
  );
});

/**
 * Icon animation for rail headers
 */
interface RailIconAnimationProps {
  style: RailAnimationStyle;
  children: React.ReactNode;
}

const iconAnimationVariants: Record<RailAnimationStyle, Variants> = {
  pulse: {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
  rhythm: {
    animate: {
      rotate: [0, 10, 0, -10, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
  sparkle: {
    animate: {
      scale: [1, 1.2, 1],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
  glow: {
    animate: {
      opacity: [0.8, 1, 0.8],
      filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
  wave: {
    animate: {
      y: [0, -3, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
};

export const RailIconAnimation = memo(function RailIconAnimation({
  style,
  children,
}: RailIconAnimationProps) {
  return (
    <motion.span
      className="inline-flex"
      animate="animate"
      variants={iconAnimationVariants[style]}
    >
      {children}
    </motion.span>
  );
});

/**
 * Background gradient animation for rail cards
 */
interface RailBackgroundProps {
  style: RailAnimationStyle;
  className?: string;
}

const backgroundColors: Record<RailAnimationStyle, string> = {
  pulse: "from-blue-500/5 to-cyan-500/5",
  rhythm: "from-amber-500/5 to-orange-500/5",
  sparkle: "from-purple-500/5 to-pink-500/5",
  glow: "from-indigo-500/5 to-violet-500/5",
  wave: "from-emerald-500/5 to-teal-500/5",
};

export const RailBackground = memo(function RailBackground({
  style,
  className = "",
}: RailBackgroundProps) {
  return (
    <motion.div
      className={`absolute inset-0 bg-gradient-to-r ${backgroundColors[style]} -mx-6 skew-y-1 rounded-3xl -z-10 pointer-events-none ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    />
  );
});
