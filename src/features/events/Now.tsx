import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, MapPin, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/shared/components';
import { useAuth } from '@/features/auth';
import { useLocation } from '@/features/location';
import { hapticImpact } from '@/shared/lib/haptics';
import { TimeDial } from './components/TimeDial';
import { LiveEventCard } from './components/LiveEventCard';
import { WhosOutRail } from './components/WhosOutRail';
import { useLiveEventsQuery } from './hooks/useLiveEventsQuery';
import type { EventWithAttendees } from './hooks/hooks';

/**
 * Now Page - The Spontaneous Engine
 * 
 * A completely new, standalone feature for immediate action and spontaneity.
 * Visual: Dark Mode Only - "Night Mode" aesthetic (Deep Black, Neon Glass, White Text)
 * 
 * Key Features:
 * - Kinetic Time-Dial: Filter events by time window (Live to +4h)
 * - Real-Time Event Stream: Events happening now or soon
 * - "Who's Out?" Rail: Friends currently at events
 */
const Now = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs } = useLocation();
  
  // Time dial state (minutes from now)
  const [timeOffset, setTimeOffset] = useState(60); // Default 1 hour
  const [isDragging, setIsDragging] = useState(false);
  const [debouncedOffset, setDebouncedOffset] = useState(timeOffset);

  // Debounce the time offset for API calls (300ms)
  useEffect(() => {
    if (isDragging) return; // Don't update while dragging
    
    const timer = setTimeout(() => {
      setDebouncedOffset(timeOffset);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [timeOffset, isDragging]);

  // Fetch live events
  const { events, loading, isRefetching } = useLiveEventsQuery({
    timeOffsetMinutes: debouncedOffset,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    currentUserProfileId: profile?.id,
    enabled: !isDragging, // Disable query while dragging
  });

  // Handle dial changes
  const handleTimeChange = useCallback((minutes: number) => {
    setTimeOffset(minutes);
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle "Go" action - open in maps
  const handleGo = useCallback((event: EventWithAttendees) => {
    // Try to open in maps app
    const query = encodeURIComponent(event.venue_name || event.title);
    const mapsUrl = `https://maps.google.com/maps?q=${query}`;
    window.open(mapsUrl, '_blank');
  }, []);

  // Handle "Summon" action - share with friends
  const handleSummon = useCallback(async (event: EventWithAttendees) => {
    const shareData = {
      title: event.title,
      text: `Join me at ${event.venue_name || 'this event'}!`,
      url: window.location.href,
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`${shareData.title} - ${shareData.text}`);
      await hapticImpact('light');
    }
  }, []);

  // Handle friend click
  const handleFriendClick = useCallback((userId: string, eventId?: string) => {
    // In a full implementation, this would open a chat or event detail
    console.log('Friend clicked:', userId, eventId);
  }, []);

  // Handle back navigation
  const handleBack = useCallback(async () => {
    await hapticImpact('light');
    navigate('/');
  }, [navigate]);

  // Calculate gradient background based on time offset
  const backgroundGradient = useMemo(() => {
    const progress = timeOffset / 240;
    // Neon Orange -> Deep Purple transition
    const r1 = Math.round(255 - progress * 147); // 255 -> 108
    const g1 = Math.round(107 - progress * 37);  // 107 -> 70
    const b1 = Math.round(44 + progress * 149);  // 44 -> 193
    return `linear-gradient(180deg, rgb(${r1}, ${g1}, ${b1}) 0%, #0a0a0a 40%)`;
  }, [timeOffset]);

  return (
    <div 
      className="min-h-screen text-white font-sans selection:bg-orange-500 selection:text-white"
      style={{ background: '#0a0a0a' }}
    >
      {/* Gradient overlay from dial color */}
      <div 
        className="fixed inset-0 pointer-events-none transition-all duration-500"
        style={{ background: backgroundGradient, opacity: 0.15 }}
      />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 pb-32"
      >
        {/* Header */}
        <header className="sticky top-0 z-40 pt-safe">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Back button */}
            <button 
              onClick={handleBack}
              className="flex items-center gap-1 text-white/80 hover:text-white transition-colors min-h-[44px] min-w-[44px] -ml-2 pl-2"
            >
              <ChevronLeft size={24} />
              <span className="text-[15px] font-medium">Back</span>
            </button>
            
            {/* Title */}
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-orange-400" />
              <span className="text-[17px] font-bold text-white">Now</span>
            </div>
            
            {/* Location indicator */}
            <div className="flex items-center gap-1 text-white/60">
              <MapPin size={14} />
              <span className="text-[13px]">{locationPrefs.manualZone || 'Nearby'}</span>
            </div>
          </div>
        </header>

        {/* Time Dial */}
        <TimeDial
          value={timeOffset}
          onChange={handleTimeChange}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />

        {/* Who's Out Rail */}
        <WhosOutRail
          currentUserProfileId={profile?.id}
          timeOffsetMinutes={timeOffset}
          onFriendClick={handleFriendClick}
        />

        {/* Event Stream */}
        <main className="px-4 mt-4">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white/90 font-semibold text-[15px]">
              {timeOffset === 0 ? 'Happening Now' : `Next ${Math.ceil(timeOffset / 60)} ${timeOffset >= 60 ? 'hours' : 'hour'}`}
            </h2>
            {(loading || isRefetching) && (
              <div className="w-4 h-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            )}
          </div>

          {/* Event list */}
          <AnimatePresence mode="popLayout">
            {events.length > 0 ? (
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {events.map((event) => (
                  <LiveEventCard
                    key={event.id}
                    event={event}
                    onGo={handleGo}
                    onSummon={handleSummon}
                  />
                ))}
              </motion.div>
            ) : loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-2xl bg-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <p className="text-white/60 text-[15px]">
                  No events in this time window
                </p>
                <p className="text-white/40 text-[13px] mt-2">
                  Try expanding the time range
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Floating Nav - highlight Now button */}
      <FloatingNav activeView="now" />
    </div>
  );
};

export default Now;
