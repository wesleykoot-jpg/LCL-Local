import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeviceTilt } from '@/hooks/useDeviceTilt';
import { hapticImpact } from '@/shared/lib/haptics';
import { useAuth } from '@/features/auth';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { ReliabilityBadge } from '@/components/ui/ReliabilityBadge';
import { StatBlock } from '@/components/ui/StatBlock';

/**
 * IdentityCard - v5.0 Social Air Design
 * 
 * A clean, solid white card that serves as the user's identity.
 * Features subtle 3D tilt on touch (if performance allows), 
 * "Air Shadows", and high-contrast legibility.
 * 
 * Credit card aspect ratio: 1.58:1
 * Uses the "Physical Cardstock over Virtual Glass" philosophy.
 */

// Mock profile data - fallback only when no backend data
const MOCK_PROFILE = {
  full_name: 'Demo User',
  avatar_url: null,
  current_persona: 'social',
};

// Mock stats - fallback only when no backend data
const MOCK_STATS = {
  events: 12,
  friends: 84,
  score: 98,
};

export function IdentityCard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const motionPreset = useMotionPreset();
  const [isPressed, setIsPressed] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enable subtle device tilt for 3D effect (optional enhancement)
  const tilt = useDeviceTilt({
    sensitivity: 0.5,
    maxTilt: 8,
    smoothing: 0.2,
    enabled: !motionPreset.prefersReducedMotion,
  });

  // Use profile data or fallback to mock
  const displayProfile = profile || MOCK_PROFILE;

  const avatarInitial = displayProfile.full_name
    ? displayProfile.full_name.charAt(0).toUpperCase()
    : 'U';

  // Handle long press on avatar
  const handlePressStart = () => {
    setIsPressed(true);
    pressTimerRef.current = setTimeout(async () => {
      await hapticImpact('heavy');
      setIsPressed(false);
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsPressed(false);
  };

  // Use stats from profile or mock data
  const stats = {
    events: profile?.events_attended ?? MOCK_STATS.events,
    friends: 84, // TODO: Add friends_count to profile schema when available
    score: profile?.reliability_score
      ? Math.round(profile.reliability_score)
      : MOCK_STATS.score,
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tilt Transform Container */}
      <motion.div
        className="tilt-transform"
        style={{
          perspective: motionPreset.prefersReducedMotion ? 'none' : '1000px',
        }}
      >
        {/* v5.0 Social Air Card - Solid White with Air Shadow */}
        <motion.div
          className="relative w-full bg-surface-card rounded-card shadow-floating overflow-hidden"
          style={{
            aspectRatio: '1.58 / 1',
            transform: motionPreset.prefersReducedMotion
              ? 'none'
              : `rotateY(${tilt.tiltX * 0.3}deg) rotateX(${-tilt.tiltY * 0.3}deg)`,
          }}
          {...(motionPreset.prefersReducedMotion ? {} : {
            initial: { scale: 0.95, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            transition: { type: 'spring', damping: 20, stiffness: 150 },
          })}
        >
          {/* Card Content */}
          <div className="relative z-10 p-6 h-full flex flex-col">
            {/* Top Row: Avatar and Name */}
            <div className="flex items-start gap-4 mb-auto">
              {/* Avatar with Long Press Interaction */}
              <motion.button
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerLeave={handlePressEnd}
                className="relative shrink-0"
                whileHover={motionPreset.prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={motionPreset.prefersReducedMotion ? {} : { scale: 0.95 }}
                aria-label={`${displayProfile.full_name}'s avatar - long press to interact`}
              >
                <div
                  className={`w-16 h-16 rounded-full bg-gray-200 border-2 border-white shadow-card flex items-center justify-center text-text-secondary text-2xl font-bold overflow-hidden transition-all ${isPressed ? 'ring-4 ring-brand-primary/30' : ''
                    }`}
                >
                  {displayProfile.avatar_url ? (
                    <img
                      src={displayProfile.avatar_url}
                      alt={displayProfile.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    avatarInitial
                  )}
                </div>
                {/* Ripple effect on long press */}
                {isPressed && !motionPreset.prefersReducedMotion && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-brand-primary"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                )}
              </motion.button>

              {/* Name and Reliability Badge */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-text-primary leading-tight truncate mb-2">
                  {displayProfile.full_name}
                </h2>
                <div className="flex items-center justify-between">
                  <ReliabilityBadge score={stats.score} />

                  {/* Edit Profile Button - Subtle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/profile/personal-information');
                    }}
                    className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors"
                    aria-label="Edit Profile"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Social Stats Bar - v5.0 Clean Style */}
            <motion.div
              className="flex items-center justify-around pt-4 mt-4 border-t border-gray-100"
              role="region"
              aria-label="Profile statistics"
              {...(motionPreset.prefersReducedMotion ? {} : {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.2 },
              })}
            >
              <StatBlock value={stats.events} label="Events" />
              <div className="w-px h-8 bg-gray-200" aria-hidden="true" />
              <StatBlock value={stats.events} label="Events" />
              <div className="w-px h-8 bg-gray-200" aria-hidden="true" />

              {/* Interactive Friends Stat */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Open Friends List Modal
                  console.log('Open friends list');
                }}
                className="hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors"
              >
                <StatBlock value={stats.friends} label="Friends" />
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
