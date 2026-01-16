import { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useDeviceTilt } from '@/hooks/useDeviceTilt';
import { hapticImpact } from '@/shared/lib/haptics';
import { useAuth } from '@/features/auth';

/**
 * IdentityCard - The Prism
 * 
 * A 3D-tilting glass card that serves as the user's holographic identity.
 * Features device tilt physics, holographic sheen, and haptic interactions.
 * Credit card aspect ratio: 1.58:1
 */

// Mock profile data for development
const MOCK_PROFILE = {
  full_name: 'Demo User',
  avatar_url: null,
  current_persona: 'social',
  bio: 'Living life one event at a time ✨',
};

// Mock social stats - TODO: Wire to real backend data
const MOCK_STATS = {
  events: 12,
  friends: 84,
  score: 98,
};

// Default persona pills - TODO: Derive from user profile data
const DEFAULT_PERSONA_PILLS = ['Foodie', 'Nightlife', 'Art'];

/**
 * VibeEQ - Animated Waveform Component
 * 
 * Small animated bars that signify "Live Status" next to the user's name.
 */
function VibeEQ() {
  return (
    <div className="flex items-center gap-0.5 h-4">
      <motion.div
        className="w-0.5 bg-white/80 rounded-full"
        animate={{ height: ['40%', '100%', '60%', '80%', '40%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="w-0.5 bg-white/80 rounded-full"
        animate={{ height: ['80%', '40%', '100%', '50%', '80%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      />
      <motion.div
        className="w-0.5 bg-white/80 rounded-full"
        animate={{ height: ['60%', '90%', '50%', '100%', '60%'] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />
    </div>
  );
}

export function IdentityCard() {
  const { profile } = useAuth();
  const prefersReducedMotion = useReducedMotion();
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

  // Use persona pills from configuration - TODO: Derive from user profile
  const personaPills = DEFAULT_PERSONA_PILLS;

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

  // Calculate holographic sheen position (opposite to tilt)
  const sheenX = -tilt.tiltX * 2;
  const sheenY = -tilt.tiltY * 2;

  // Use stats from profile or mock data
  const stats = MOCK_STATS; // TODO: Wire to real profile stats
  const bio = displayProfile.bio || MOCK_PROFILE.bio;

  return (
    <div className="w-full max-w-md mx-auto px-6 py-8">
      {/* Tilt Transform Container */}
      <motion.div
        className="tilt-transform"
        style={{
          perspective: prefersReducedMotion ? 'none' : '1000px',
        }}
      >
        {/* The Prism Card */}
        <motion.div
          className="tilt-content relative w-full rounded-2xl overflow-hidden shadow-2xl"
          style={{
            aspectRatio: '1.58 / 1',
            transform: prefersReducedMotion
              ? 'none'
              : `rotateY(${tilt.tiltX * 0.5}deg) rotateX(${-tilt.tiltY * 0.5}deg)`,
          }}
          initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 150 }}
        >
          {/* Glass Background */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl border border-white/20" />

          {/* Holographic Sheen Overlay */}
          {!prefersReducedMotion && (
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
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
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
          <div className="relative z-10 p-6 h-full flex flex-col">
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
              >
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br from-white/40 to-white/20 border-2 border-white flex items-center justify-center text-white text-2xl font-bold overflow-hidden transition-all ${
                    isPressed ? 'ring-4 ring-white/50' : ''
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
                {isPressed && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-white"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                )}
              </motion.button>

              {/* Name and Handle with Vibe EQ */}
              <div className="text-right flex-1 ml-4">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {displayProfile.full_name}
                  </h2>
                  {/* Vibe EQ - Animated Waveform */}
                  {!prefersReducedMotion && <VibeEQ />}
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
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <button
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="text-white/80 text-sm text-left w-full"
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
            <div className="flex gap-2 flex-wrap mb-3">
              {personaPills.map((pill, index) => (
                <motion.div
                  key={pill}
                  className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 text-white text-xs font-medium"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  {pill}
                </motion.div>
              ))}
            </div>

            {/* Social Stats Bar */}
            <motion.div 
              className="flex items-center justify-around pt-3 border-t border-white/20"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-center">
                <p className="text-white font-bold text-lg">{stats.events}</p>
                <p className="text-white/60 text-xs">Events</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-lg">{stats.friends}</p>
                <p className="text-white/60 text-xs">Friends</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-green-400 font-bold text-lg">{stats.score}%</p>
                <p className="text-white/60 text-xs">Score</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
