import { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Music, 
  Dumbbell, 
  Gamepad2, 
  UtensilsCrossed, 
  Palette,
  Film,
  Trees,
  Sparkles,
  Users,
  Baby,
} from 'lucide-react';
import { hapticImpact } from '@/shared/lib/haptics';
import { useFriendsPulse } from '../hooks/useFriendsPulse';
import toast from 'react-hot-toast';

interface FriendsPulseRailProps {
  currentUserProfileId?: string;
  onEventClick?: (eventId: string) => void;
}

interface FriendActivity {
  user: {
    id: string;
    avatar_url: string | null;
    first_name: string;
  };
  status: 'live' | 'upcoming';
  event: {
    id: string;
    title: string;
    category: string;
  };
}

// Map categories to lucide-react icons
const getCategoryIcon = (category: string) => {
  const iconMap: Record<string, typeof Music> = {
    music: Music,
    nightlife: Music,
    sports: Dumbbell,
    active: Dumbbell,
    wellness: Dumbbell,
    gaming: Gamepad2,
    food: UtensilsCrossed,
    foodie: UtensilsCrossed,
    market: UtensilsCrossed,
    arts: Palette,
    crafts: Palette,
    workshops: Palette,
    cinema: Film,
    entertainment: Film,
    outdoors: Trees,
    family: Baby,
    community: Users,
    social: Users,
  };
  
  const IconComponent = iconMap[category.toLowerCase()] || Sparkles;
  return IconComponent;
};

export const FriendsPulseRail = memo(function FriendsPulseRail({
  currentUserProfileId,
  onEventClick,
}: FriendsPulseRailProps) {
  const { activities, loading, error } = useFriendsPulse(currentUserProfileId);

  const handleAvatarClick = useCallback(async (activity: FriendActivity) => {
    await hapticImpact('medium');
    
    if (activity.event?.id) {
      // Open event detail modal
      onEventClick?.(activity.event.id);
    } else {
      // Show toast if friend has no plans
      toast(`${activity.user.first_name} is free tonight. Invite them?`, {
        icon: '👋',
        duration: 3000,
      });
    }
  }, [onEventClick]);

  // Don't render if no current user or no activities
  if (!currentUserProfileId || loading || error || !activities || activities.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full overflow-hidden"
    >
      {/* Container with horizontal scroll */}
      <div 
        className="overflow-x-auto scrollbar-hide px-4 py-3"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Flex container for items */}
        <div className="flex items-center gap-4 min-w-min">
          {activities.map((activity) => {
            const Icon = getCategoryIcon(activity.event.category);
            const isLive = activity.status === 'live';
            
            return (
              <motion.button
                key={activity.user.id}
                onClick={() => handleAvatarClick(activity)}
                className="flex flex-col items-center gap-2 flex-shrink-0"
                whileTap={{ scale: 0.95 }}
              >
                {/* Avatar with status ring */}
                <div className="relative">
                  {/* Status ring */}
                  <div
                    className={`absolute inset-0 rounded-full ${
                      isLive
                        ? 'border-[3px] border-green-500 animate-pulse'
                        : 'border-[3px] border-blue-500'
                    }`}
                    style={{
                      padding: '2px',
                    }}
                  />
                  
                  {/* Avatar image */}
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-background">
                    {activity.user.avatar_url ? (
                      <img
                        src={activity.user.avatar_url}
                        alt={activity.user.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40 text-foreground font-semibold text-lg">
                        {activity.user.first_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Category badge icon - bottom right */}
                  <div
                    className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 border-background ${
                      isLive ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                  >
                    <Icon size={14} className="text-white" />
                  </div>
                </div>
                
                {/* Name label */}
                <span className="text-xs font-medium text-foreground max-w-[64px] truncate">
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
