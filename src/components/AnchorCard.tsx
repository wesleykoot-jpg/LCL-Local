import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { SlideToCommit } from './SlideToCommit';
import { Film } from 'lucide-react';

interface AnchorCardProps {
  title: string;
  image: string;
  matchPercentage: number;
  distance: string;
  category: string;
  date: string;
  eventId: string;
  onCommit?: (eventId: string) => void;
  children?: React.ReactNode;
}

export const AnchorCard = memo(function AnchorCard({
  title,
  image,
  matchPercentage,
  distance,
  category,
  date,
  eventId,
  onCommit,
  children
}: AnchorCardProps) {
  return (
    <div className="w-full">
      {/* 2026 Apple Design: Refined card with subtle shadow and premium feel */}
      <motion.div 
        className="relative w-full min-h-[520px] rounded-4xl overflow-hidden group shadow-apple-lg bg-zinc-900"
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Background Image (Poster Art) */}
        <div className="absolute inset-0 rounded-4xl overflow-hidden">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover" 
          />
          {/* 2026: Cinematic gradient - more subtle, less heavy */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        </div>

        {/* Content Container */}
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-10">
          {/* 2026: Premium glass badge with refined blur */}
          <div className="flex justify-start">
            <div className="glass-dark border border-white/20 rounded-2xl px-4 py-2 flex items-center gap-2.5 text-white text-xs font-semibold shadow-lg">
              <Film size={14} className="text-white/90" />
              <span className="tracking-wide">{category}</span>
              <div className="w-px h-3 bg-white/30" />
              <span className="text-amber-400 font-bold">{matchPercentage}% Match</span>
            </div>
          </div>

          {/* Bottom: Title & Action */}
          <div className="space-y-6 pb-4 max-w-full">
            <div className="space-y-3">
              {/* 2026: Clean metadata without neon colors */}
              <p className="text-white/70 font-medium tracking-wide uppercase text-xs md:text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60"></span>
                {date} • {distance}
              </p>
              {/* 2026: Enhanced title legibility */}
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.05] tracking-tight line-clamp-3">
                {title}
              </h2>
            </div>

            <div className="max-w-sm pt-2">
              <SlideToCommit
                label="SLIDE TO BOOK"
                onCommit={() => onCommit?.(eventId)}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Threaded Children (Forked Events) */}
      {children && (
        <div className="flex mt-3 pl-4">
          {/* Thread Line Container */}
          <div className="w-10 flex-shrink-0 flex justify-center relative">
            {/* Vertical Line from parent */}
            <div className="absolute top-0 bottom-1/2 left-1/2 w-0.5 bg-zinc-200 -translate-x-1/2"></div>
            {/* Curve to child */}
            <div className="absolute top-0 h-1/2 left-1/2 w-6 border-b-2 border-l-2 border-zinc-200 rounded-bl-2xl -translate-x-1/2"></div>
          </div>

          {/* Child Content */}
          <div className="flex-1 pt-4 pb-2">{children}</div>
        </div>
      )}
    </div>
  );
});
