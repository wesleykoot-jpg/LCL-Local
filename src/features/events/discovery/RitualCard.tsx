/**
 * Ritual Card Variant
 * 
 * A specialized event card variant for Ritual events that emphasizes:
 * - Repetition and safety (visual "stamp")
 * - Streak tracking ("3rd week in a row")
 * - Ritual day indicator ("Every Tuesday")
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { Calendar, Repeat, Flame, Clock } from "lucide-react";
import type { RitualEventMeta } from "./types";
import { formatStreakText, formatRitualDayLabel } from "./TitleFormatter";

interface RitualCardBadgeProps {
  ritualMeta: RitualEventMeta;
  className?: string;
}

/**
 * Ritual Badge - Shows on ritual event cards
 * Displays the recurring nature and user streak
 */
export const RitualBadge = memo(function RitualBadge({
  ritualMeta,
  className = "",
}: RitualCardBadgeProps) {
  if (!ritualMeta.isRitual) return null;
  
  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Repeat className="w-3 h-3" />
      <span>{formatRitualDayLabel(ritualMeta.ritualDay)}</span>
    </motion.div>
  );
});

/**
 * Streak Badge - Shows user's participation streak
 */
interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export const StreakBadge = memo(function StreakBadge({
  streak,
  className = "",
}: StreakBadgeProps) {
  const streakText = formatStreakText(streak);
  if (!streakText) return null;
  
  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium ${className}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Flame className="w-3 h-3" />
      <span>{streakText}</span>
    </motion.div>
  );
});

/**
 * Ritual Stamp - Visual indicator overlaid on ritual cards
 */
interface RitualStampProps {
  ritualMeta: RitualEventMeta;
  size?: "sm" | "md" | "lg";
}

export const RitualStamp = memo(function RitualStamp({
  ritualMeta,
  size = "md",
}: RitualStampProps) {
  if (!ritualMeta.isRitual) return null;
  
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };
  
  const iconSizes = {
    sm: 14,
    md: 20,
    lg: 28,
  };
  
  return (
    <motion.div
      className={`absolute top-2 right-2 ${sizeClasses[size]} flex items-center justify-center rounded-full bg-amber-500/90 text-white shadow-lg backdrop-blur-sm`}
      initial={{ opacity: 0, rotate: -45, scale: 0 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: 0.3,
        type: "spring",
        stiffness: 200,
      }}
    >
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      >
        <Clock size={iconSizes[size]} strokeWidth={2.5} />
      </motion.div>
    </motion.div>
  );
});

/**
 * Ritual Card Footer - Shows ritual info at bottom of card
 */
interface RitualCardFooterProps {
  ritualMeta: RitualEventMeta;
  className?: string;
}

export const RitualCardFooter = memo(function RitualCardFooter({
  ritualMeta,
  className = "",
}: RitualCardFooterProps) {
  if (!ritualMeta.isRitual) return null;
  
  return (
    <motion.div
      className={`flex flex-wrap gap-2 mt-2 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <RitualBadge ritualMeta={ritualMeta} />
      {ritualMeta.userStreak && ritualMeta.userStreak >= 2 && (
        <StreakBadge streak={ritualMeta.userStreak} />
      )}
      {ritualMeta.occurrenceCount && ritualMeta.occurrenceCount >= 3 && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
          <Calendar className="w-3 h-3" />
          <span>{ritualMeta.occurrenceCount}+ times</span>
        </div>
      )}
    </motion.div>
  );
});

/**
 * Ritual Card Wrapper - Adds ritual styling to any card
 */
interface RitualCardWrapperProps {
  ritualMeta: RitualEventMeta;
  children: React.ReactNode;
  className?: string;
}

export const RitualCardWrapper = memo(function RitualCardWrapper({
  ritualMeta,
  children,
  className = "",
}: RitualCardWrapperProps) {
  const isRitual = ritualMeta.isRitual;
  
  return (
    <motion.div
      className={`relative ${isRitual ? "ring-2 ring-amber-200 ring-offset-2" : ""} rounded-card ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={isRitual ? { scale: 1.02 } : undefined}
    >
      {isRitual && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-card pointer-events-none" />
      )}
      {children}
      {isRitual && <RitualStamp ritualMeta={ritualMeta} size="sm" />}
    </motion.div>
  );
});
