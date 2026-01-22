import { memo } from 'react';
import { Loader2, Check, CalendarPlus } from 'lucide-react';
import type { TimeMode } from '@/lib/openingHours';

interface EventActionButtonsProps {
  eventId: string;
  timeMode: TimeMode;
  hasJoined: boolean;
  isJoining: boolean;
  isPast?: boolean;
  onJoin: (e: React.MouseEvent) => void;
  onPlanHere: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * EventActionButtons - Smart action buttons based on event time mode
 * 
 * - Fixed events: Shows "Join" button for standard RSVP flow
 * - Window/Anytime venues: Shows "Plan Here" to create a proposal
 */
export const EventActionButtons = memo(function EventActionButtons({
  timeMode,
  hasJoined,
  isJoining,
  isPast = false,
  onJoin,
  onPlanHere,
  className = '',
}: EventActionButtonsProps) {
  // Don't show buttons for past events
  if (isPast) {
    return null;
  }

  // Already joined state - show badge
  if (hasJoined) {
    return (
      <div className={`${className}`}>
        <div className="w-full h-[44px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-secondary text-foreground border-2 border-primary/20">
          <Check size={16} className="text-brand-primary" />
          <span>Going</span>
        </div>
      </div>
    );
  }

  // Fixed events - show "Join" button
  if (timeMode === 'fixed') {
    return (
      <div className={`${className}`}>
        <button
          onClick={onJoin}
          disabled={isJoining}
          className={`w-full h-[44px] rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98] ${
            isJoining
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {isJoining ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>Joining...</span>
            </div>
          ) : (
            'Join'
          )}
        </button>
      </div>
    );
  }

  // Window or Anytime venues - show "Plan Here" button
  return (
    <div className={`${className}`}>
      <button
        onClick={onPlanHere}
        className="w-full h-[44px] rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98] bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-2"
      >
        <CalendarPlus size={16} />
        <span>Plan Here</span>
      </button>
    </div>
  );
});
