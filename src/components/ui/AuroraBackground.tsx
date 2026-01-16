import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * AuroraBackground - Ambient Atmosphere Layer
 * 
 * A fixed, full-screen background with 3 large, blurred color blobs that slowly drift.
 * Includes a subtle noise texture overlay to prevent digital banding.
 * This provides "atmosphere" behind glass UI elements.
 */

interface AuroraBackgroundProps {
  children: ReactNode;
}

export function AuroraBackground({ children }: AuroraBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen">
      {/* Fixed Aurora Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Animated Color Blobs */}
        {!prefersReducedMotion && (
          <>
            {/* Purple Blob */}
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full opacity-30"
              style={{
                background: 'radial-gradient(circle, rgba(147, 51, 234, 0.4) 0%, rgba(147, 51, 234, 0) 70%)',
                filter: 'blur(100px)',
              }}
              animate={{
                x: ['-10%', '10%', '-10%'],
                y: ['-10%', '20%', '-10%'],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              initial={{ x: '10%', y: '10%' }}
            />

            {/* Deep Blue Blob */}
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full opacity-25"
              style={{
                background: 'radial-gradient(circle, rgba(30, 58, 138, 0.5) 0%, rgba(30, 58, 138, 0) 70%)',
                filter: 'blur(100px)',
                right: 0,
              }}
              animate={{
                x: ['0%', '-15%', '0%'],
                y: ['20%', '40%', '20%'],
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              initial={{ x: '0%', y: '30%' }}
            />

            {/* Emerald Blob */}
            <motion.div
              className="absolute w-[450px] h-[450px] rounded-full opacity-20"
              style={{
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%)',
                filter: 'blur(100px)',
                bottom: 0,
              }}
              animate={{
                x: ['30%', '50%', '30%'],
                y: ['0%', '-10%', '0%'],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              initial={{ x: '40%', y: '0%' }}
            />
          </>
        )}

        {/* Subtle Noise Texture Overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px',
          }}
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
