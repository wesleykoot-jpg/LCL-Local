import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { ReliabilityBadge } from '@/components/ui/ReliabilityBadge';
import { StatBlock } from '@/components/ui/StatBlock';

/**
 * MorphingHeader - A scroll-driven morphing identity header
 * 
 * Part of the v5.0 "Social Air" Design System.
 * 
 * Features:
 * - Initial state: Floating solid white Identity Card (aspect ratio ~1.58:1)
 * - Scroll interaction: Card scales down and morphs into a sticky nav bar
 * - Uses spring physics for weighty, physical feel
 * - Smooth transition between absolute and fixed positioning
 * 
 * Animation Physics:
 * - Scroll threshold: 0 to 200px
 * - Uses useTransform for smooth interpolation
 * - Spring config: damping 25, stiffness 200, mass 0.5
 */

// Mock profile data - fallback only when no backend data
const MOCK_PROFILE = {
  full_name: 'Demo User',
  avatar_url: null,
  current_persona: 'social',
};

const MOCK_STATS = {
  events: 12,
  friends: 84,
  score: 98,
};

interface MorphingHeaderProps {
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function MorphingHeader({ containerRef }: MorphingHeaderProps) {
  const { profile } = useAuth();
  const motionPreset = useMotionPreset();
  const localRef = useRef<HTMLDivElement>(null);
  
  // Use passed container ref or local ref
  const targetRef = containerRef || localRef;
  
  const { scrollY } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"],
  });

  // Scroll thresholds: 0px (full card) to 200px (docked nav)
  const SCROLL_START = 0;
  const SCROLL_END = 200;

  // Transform values based on scroll position
  const scale = useTransform(scrollY, [SCROLL_START, SCROLL_END], [1, 0.85]);
  const opacity = useTransform(scrollY, [SCROLL_START, SCROLL_END], [1, 0]);
  const cardHeight = useTransform(scrollY, [SCROLL_START, SCROLL_END], [220, 64]);
  const borderRadius = useTransform(scrollY, [SCROLL_START, SCROLL_END], [20, 0]);
  const padding = useTransform(scrollY, [SCROLL_START, SCROLL_END], [24, 16]);
  
  // Nav bar visibility (appears after scroll threshold)
  const navOpacity = useTransform(scrollY, [SCROLL_END - 50, SCROLL_END], [0, 1]);
  
  // Use profile data or fallback to mock
  const displayProfile = profile || MOCK_PROFILE;
  const avatarInitial = displayProfile.full_name
    ? displayProfile.full_name.charAt(0).toUpperCase()
    : 'U';

  const stats = {
    events: profile?.events_attended ?? MOCK_STATS.events,
    // TODO(schema): Add friends_count to profiles table when social graph feature is implemented
    friends: MOCK_STATS.friends,
    score: profile?.reliability_score 
      ? Math.round(profile.reliability_score) 
      : MOCK_STATS.score,
  };

  return (
    <div ref={localRef} className="relative">
      {/* Floating Identity Card - Initial State */}
      <motion.div
        className="bg-surface-card shadow-floating rounded-card overflow-hidden"
        style={{
          scale: motionPreset.prefersReducedMotion ? 1 : scale,
          borderRadius: motionPreset.prefersReducedMotion ? 20 : borderRadius,
        }}
        transition={{
          type: 'spring',
          damping: 25,
          stiffness: 200,
          mass: 0.5,
        }}
      >
        <motion.div
          className="p-6"
          style={{
            padding: motionPreset.prefersReducedMotion ? 24 : padding,
            opacity: motionPreset.prefersReducedMotion ? 1 : opacity,
          }}
        >
          {/* Card Content - Expands to show full stats */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-white shadow-card flex items-center justify-center overflow-hidden">
                {displayProfile.avatar_url ? (
                  <img
                    src={displayProfile.avatar_url}
                    alt={displayProfile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-text-secondary">
                    {avatarInitial}
                  </span>
                )}
              </div>
            </div>

            {/* Name and Reliability */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text-primary truncate mb-1">
                {displayProfile.full_name}
              </h1>
              <ReliabilityBadge score={stats.score} />
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-around mt-6 pt-4 border-t border-gray-100">
            <StatBlock value={stats.events} label="Events" />
            <div className="w-px h-8 bg-gray-200" aria-hidden="true" />
            <StatBlock value={stats.friends} label="Friends" />
            <div className="w-px h-8 bg-gray-200" aria-hidden="true" />
            <StatBlock value={`${stats.score}%`} label="Score" highlight />
          </div>
        </motion.div>
      </motion.div>

      {/* Docked Navigation Bar - Fixed position at top when scrolled */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 bg-surface-card shadow-bottom-nav"
        style={{
          opacity: motionPreset.prefersReducedMotion ? 0 : navOpacity,
          pointerEvents: 'auto',
        }}
        aria-hidden={motionPreset.prefersReducedMotion}
      >
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          {/* Compact Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-200 border border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            {displayProfile.avatar_url ? (
              <img
                src={displayProfile.avatar_url}
                alt={displayProfile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-text-secondary">
                {avatarInitial}
              </span>
            )}
          </div>

          {/* Compact Name */}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-text-primary truncate">
              {displayProfile.full_name}
            </h1>
          </div>

          {/* Compact Score */}
          <ReliabilityBadge score={stats.score} className="shrink-0" />
        </div>
      </motion.div>
    </div>
  );
}
