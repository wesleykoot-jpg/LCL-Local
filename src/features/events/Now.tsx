import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/shared/components';
import { useAuth } from '@/features/auth';
import { useLocation } from '@/features/location';
import { hapticImpact } from '@/shared/lib/haptics';
import { LiveEventCard } from './components/LiveEventCard';
import { useLiveEventsQuery, getDaypartGreeting } from './hooks/useLiveEventsQuery';
import type { EventWithAttendees } from './hooks/hooks';

/**
 * Now Page - The Social Concierge
 * 
 * A map-forward, time-aware utility for immediate action and spontaneity.
 * Visual: Light/Glass Theme (matches io26-glass.css and rest of the app)
 * 
 * Layout: Split View (Airbnb Mobile style)
 * - Top 60%: Map View with user location dot and venue pins
 * - Bottom 40%: Draggable/Scrollable Sheet with event list
 * 
 * Key Features:
 * - Smart Context (Dayparting): Categories change based on time of day
 * - Dynamic Greeting: "Good Morning/Afternoon/Evening, [Name]"
 * - Distance-sorted events (proximity is key for "Now")
 */
const Now = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs } = useLocation();
  
  // Time offset for live events (0-240 minutes)
  const [timeOffset] = useState(120); // Default 2 hours for concierge mode

  // Fetch live events with dayparting
  const { events, loading, daypartMode } = useLiveEventsQuery({
    timeOffsetMinutes: timeOffset,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    currentUserProfileId: profile?.id,
    enabled: true,
  });

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const firstName = profile?.full_name?.split(' ')[0];
    return getDaypartGreeting(daypartMode, firstName);
  }, [daypartMode, profile?.full_name]);

  // Handle event click - open in maps or detail
  const handleEventClick = useCallback(async (event: EventWithAttendees) => {
    await hapticImpact('light');
    // Open in maps app for navigation
    const query = encodeURIComponent(event.venue_name || event.title);
    const mapsUrl = `https://maps.google.com/maps?q=${query}`;
    window.open(mapsUrl, '_blank');
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative h-screen flex flex-col"
      >
        {/* Map Section - Top 60% */}
        <div className="relative h-[60vh] bg-muted overflow-hidden">
          {/* Map Placeholder - In production, integrate with Mapbox/Google Maps */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-blue-50 flex items-center justify-center">
            {/* Placeholder map styling */}
            <div className="absolute inset-0 opacity-30">
              {/* Grid pattern to simulate map */}
              <div 
                className="w-full h-full"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
                  `,
                  backgroundSize: '40px 40px',
                }}
              />
            </div>
            
            {/* User Location Dot with pulse animation */}
            <div className="relative z-10">
              <div className="absolute inset-0 -m-4 rounded-full bg-primary/20 animate-ping" />
              <div className="w-6 h-6 rounded-full bg-primary border-4 border-white shadow-lg flex items-center justify-center">
                <Navigation size={10} className="text-white fill-white" />
              </div>
            </div>

            {/* Event Pins (placeholder positions) */}
            {events.slice(0, 5).map((event, index) => {
              // Distribute pins in a circle around center for demo
              const angle = (index / 5) * 2 * Math.PI;
              const radius = 80 + Math.random() * 40;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              
              return (
                <motion.button
                  key={event.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="absolute z-20"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                  }}
                  onClick={() => handleEventClick(event)}
                >
                  <div className="w-8 h-8 rounded-full bg-card border-2 border-primary shadow-md flex items-center justify-center">
                    <MapPin size={14} className="text-primary" />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Location indicator overlay */}
          <div className="absolute top-safe left-4 right-4 pt-4 z-30">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/95 backdrop-blur-xl rounded-full shadow-lg border border-border/50">
              <MapPin size={16} className="text-primary" />
              <span className="text-[14px] font-medium text-foreground">
                {locationPrefs.manualZone || 'Current Location'}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Sheet - 40% */}
        <div className="flex-1 bg-card rounded-t-3xl -mt-6 relative z-30 shadow-[0_-4px_24px_rgba(0,0,0,0.1)] overflow-hidden">
          {/* Drag Handle */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Sheet Content */}
          <div className="px-4 pb-32 overflow-y-auto max-h-[calc(40vh+24px)]">
            {/* Dynamic Greeting Header */}
            <div className="mb-4">
              <h1 className="text-[24px] font-bold text-foreground">
                {greeting}
              </h1>
              <p className="text-[14px] text-muted-foreground mt-1">
                {events.length} {events.length === 1 ? 'place' : 'places'} open nearby
              </p>
            </div>

            {/* Event List */}
            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-muted animate-pulse"
                    />
                  ))}
                </div>
              ) : events.length > 0 ? (
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
                      onClick={handleEventClick}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <p className="text-muted-foreground text-[15px]">
                    No events happening right now
                  </p>
                  <p className="text-muted-foreground/60 text-[13px] mt-2">
                    Check back later for more
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Floating Nav */}
      <FloatingNav activeView="now" />
    </div>
  );
};

export default Now;
