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
};

// Default persona pills - TODO: Derive from user profile data
const DEFAULT_PERSONA_PILLS = ['Foodie', 'Nightlife', 'Art'];

export function IdentityCard() {
  const { profile } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);
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

              {/* Name and Handle */}
              <div className="text-right flex-1 ml-4">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {displayProfile.full_name}
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  @{displayProfile.full_name?.toLowerCase().replace(/\s+/g, '') || 'username'}
                </p>
              </div>
            </div>

            {/* Bottom Row: Persona Pills */}
            <div className="flex gap-2 flex-wrap">
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
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
