import { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { hapticImpact } from '@/shared/lib/haptics';
import { useFriendsPulse } from '../hooks/useFriendsPulse';

interface WhosOutRailProps {
  /** Current user's profile ID */
  currentUserProfileId?: string;
  /** Time offset in minutes to filter friends */
  timeOffsetMinutes: number;
  /** Callback when a friend avatar is clicked */
  onFriendClick?: (userId: string, eventId?: string) => void;
}

/**
 * WhosOutRail - "Who's Out?" Avatar Rail
 * 
 * Horizontal scroll of friend avatars showing:
 * - Friends who are checked in somewhere
 * - Friends who have RSVP'd to an event in the current time window
 * 
 * Visual:
 * - Active (at event): Solid green ring
 * - Moving (between venues): Dashed ring animation
 */
export const WhosOutRail = memo(function WhosOutRail({
  currentUserProfileId,
  timeOffsetMinutes,
  onFriendClick,
}: WhosOutRailProps) {
  const { activities, loading, error } = useFriendsPulse(currentUserProfileId);

  // Filter friends based on time window
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    
    // const now = new Date();
    // const endTime = new Date(now.getTime() + timeOffsetMinutes * 60 * 1000);
    
    return activities.filter(activity => {
      // Include all "live" friends
      if (activity.status === 'live') return true;
      
      // For "upcoming", check if the event is within the time window
      // This is a simplified check - in production you'd parse the actual event time
      return activity.status === 'upcoming';
    });
  }, [activities, timeOffsetMinutes]);

  const handleAvatarClick = useCallback(async (userId: string, eventId?: string) => {
    await hapticImpact('light');
    onFriendClick?.(userId, eventId);
  }, [onFriendClick]);

  // Don't render if no user, loading, error, or no activities
  if (!currentUserProfileId || loading || error || filteredActivities.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full px-4 py-2"
    >
      {/* Section label */}
      <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-3">
        Who's Out?
      </p>
      
      {/* Horizontal scroll container */}
      <div 
        className="overflow-x-auto scrollbar-hide -mx-4 px-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div className="flex items-center gap-4 min-w-min pb-1">
          {filteredActivities.map((activity) => {
            const isLive = activity.status === 'live';
            
            return (
              <motion.button
                key={activity.user.id}
                onClick={() => handleAvatarClick(activity.user.id, activity.event?.id)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
                whileTap={{ scale: 0.96 }}
              >
                {/* Avatar with status ring */}
                <div className="relative">
                  {/* Status ring - solid green for live, dashed for moving */}
                  <div
                    className={`absolute -inset-1 rounded-full ${
                      isLive
                        ? 'border-2 border-green-400'
                        : 'border-2 border-dashed border-blue-400 animate-spin'
                    }`}
                    style={{
                      animationDuration: isLive ? '0s' : '3s',
                    }}
                  />
                  
                  {/* Avatar image */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/10">
                    {activity.user.avatar_url ? (
                      <img
                        src={activity.user.avatar_url}
                        alt={activity.user.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500/30 to-purple-500/30 text-white font-semibold text-sm">
                        {activity.user.first_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Live indicator dot */}
                  {isLive && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-400 border-2 border-black flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                  )}
                </div>
                
                {/* Name label */}
                <span className="text-text-secondary text-[11px] font-medium max-w-[48px] truncate">
                  {activity.user.first_name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
      
      {/* Hide scrollbar with CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </motion.div>
  );
});
