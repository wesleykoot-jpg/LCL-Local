import { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useDeviceTilt } from '@/hooks/useDeviceTilt';
import { hapticImpact } from '@/shared/lib/haptics';
import { useAuth } from '@/features/auth';
import { HeroCard } from '@/components/ui/hero-card';
import { PersonaPill } from '@/components/ui/persona-pill';
import { VibeEQ } from '@/components/ui/vibe-eq';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMotionPreset } from '@/shared/hooks/useMotionPreset';

/**
 * IdentityCard - The Prism
 * 
 * A 3D-tilting glass card that serves as the user's holographic identity.
 * Features device tilt physics, holographic sheen, and haptic interactions.
 * Credit card aspect ratio: 1.58:1
 */

// Mock profile data for development (fallback when no backend data)
const MOCK_PROFILE = {
  full_name: 'Demo User',
  avatar_url: null,
  current_persona: 'social',
  bio: 'Living life one event at a time ✨',
};

// Mock social stats (fallback when no backend data)
const MOCK_STATS = {
  events: 12,
  friends: 84,
  score: 98,
};

// Default persona pills (fallback when no backend data)
const DEFAULT_PERSONA_PILLS = ['Foodie', 'Nightlife', 'Art'];

export function IdentityCard() {
  const { profile } = useAuth();
  const { fadeIn, prefersReducedMotion } = useMotionPreset();
  const [isPressed, setIsPressed] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Enable device tilt for 3D effect
  const tilt = useDeviceTilt({
    sensitivity: 1,
    maxTilt: 15,
    smoothing: 0.15,
    enabled: !prefersReducedMotion,
  });

  // Use profile data or fallback to mock
  const displayProfile = profile || MOCK_PROFILE;

  const avatarInitial = displayProfile.full_name
    ? displayProfile.full_name.charAt(0).toUpperCase()
    : 'U';

  // Derive persona pills from profile data or use defaults
  // TODO: In future, fetch from user's category preferences or persona_stats table
  const personaPills = useMemo(() => {
    // For now, use defaults - in the future this could be derived from
    // profile.current_persona or user's selected categories
    return DEFAULT_PERSONA_PILLS;
  }, []);

  // Handle long press on avatar
  const handlePressStart = () => {
    setIsPressed(true);
    pressTimerRef.current = setTimeout(async () => {
      await hapticImpact('heavy'); // "thud" haptic
      // Trigger ripple animation effect handled by CSS
      setIsPressed(false);
    }, 500); // 500ms for long press
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsPressed(false);
  };

  // Wire stats to real profile data with fallback to mock
  const stats = useMemo(() => {
    if (!profile) {
      return MOCK_STATS;
    }
    
    return {
      events: profile.events_attended || 0,
      friends: 0, // TODO: Calculate from friendships when that feature is implemented
      score: profile.reliability_score || 0,
    };
  }, [profile]);

  const bio = displayProfile.bio || MOCK_PROFILE.bio;

  return (
    <div className="w-full max-w-md mx-auto px-6 py-8">
      <HeroCard
        enableTilt
        tilt={tilt}
        enableHolographicSheen
        enableFoilAnimation
      >
        <div className="p-6 h-full flex flex-col">
          {/* Top Row: Avatar and Name */}
          <div className="flex items-start justify-between mb-auto">
            {/* Avatar with Long Press Interaction */}
            <motion.button
              onPointerDown={handlePressStart}
              onPointerUp={handlePressEnd}
              onPointerLeave={handlePressEnd}
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={`${displayProfile.full_name}'s profile picture`}
            >
              <Avatar className="w-16 h-16 border-2 border-white">
                <AvatarImage 
                  src={displayProfile.avatar_url || undefined} 
                  alt={displayProfile.full_name}
                />
                <AvatarFallback className="bg-gradient-to-br from-white/40 to-white/20 text-white text-2xl font-bold">
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
              {/* Ring effect on press */}
              {isPressed && (
                <>
                  <div className="absolute inset-0 rounded-full ring-4 ring-white/50" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-white"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </>
              )}
            </motion.button>

            {/* Name and Handle with Vibe EQ */}
            <div className="text-right flex-1 ml-4">
              <div className="flex items-center justify-end gap-2 mb-1">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {displayProfile.full_name}
                </h2>
                {/* Vibe EQ - Animated Waveform */}
                <VibeEQ />
              </div>
              <p className="text-white/60 text-sm">
                @{displayProfile.full_name?.toLowerCase().replace(/\s+/g, '') || 'username'}
              </p>
            </div>
          </div>

          {/* Bio Section - Collapsible */}
          {bio && (
            <motion.div 
              className="mb-3"
              {...fadeIn({ delay: 0.3 })}
            >
              <button
                onClick={() => setIsBioExpanded(!isBioExpanded)}
                className="text-white/80 text-sm text-left w-full"
                aria-expanded={isBioExpanded}
                aria-label={isBioExpanded ? 'Collapse bio' : 'Expand bio'}
              >
                <motion.p
                  animate={{ height: isBioExpanded ? 'auto' : '1.25rem' }}
                  className="overflow-hidden"
                >
                  {bio}
                </motion.p>
              </button>
            </motion.div>
          )}

          {/* Persona Pills */}
          <div className="flex gap-2 flex-wrap mb-3" role="list" aria-label="Interests">
            {personaPills.map((pill, index) => (
              <PersonaPill
                key={pill}
                label={pill}
                animationIndex={index}
                role="listitem"
              />
            ))}
          </div>

          {/* Social Stats Bar */}
          <motion.div 
            className="flex items-center justify-around pt-3 border-t border-white/20"
            {...fadeIn({ delay: 0.4 })}
            role="list"
            aria-label="Profile statistics"
          >
            <div className="text-center" role="listitem">
              <p className="text-white font-bold text-lg" aria-label={`${stats.events} events attended`}>
                {stats.events}
              </p>
              <p className="text-white/60 text-xs">Events</p>
            </div>
            <div className="w-px h-8 bg-white/20" aria-hidden="true" />
            <div className="text-center" role="listitem">
              <p className="text-white font-bold text-lg" aria-label={`${stats.friends} friends`}>
                {stats.friends}
              </p>
              <p className="text-white/60 text-xs">Friends</p>
            </div>
            <div className="w-px h-8 bg-white/20" aria-hidden="true" />
            <div className="text-center" role="listitem">
              <p className="text-green-400 font-bold text-lg" aria-label={`${stats.score}% reliability score`}>
                {stats.score}%
              </p>
              <p className="text-white/60 text-xs">Score</p>
            </div>
          </motion.div>
        </div>
      </HeroCard>
    </div>
  );
}
