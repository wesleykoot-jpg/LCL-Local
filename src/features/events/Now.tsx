import { useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { FloatingNav } from "@/shared/components";
import { useAuth } from "@/features/auth";
import { useLocation } from "@/features/location";
import { hapticImpact } from "@/shared/lib/haptics";
import { LiveEventCard } from "./components/LiveEventCard";
import { EventMap } from "./components/EventMap";
import {
  useLiveEventsQuery,
  getDaypartGreeting,
} from "./hooks/useLiveEventsQuery";
import type { EventWithAttendees } from "./hooks/hooks";

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
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs } = useLocation();

  // Time offset for live events (0-240 minutes)
  const timeOffset = 120; // Default 2 hours for concierge mode

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
    const firstName = profile?.full_name?.split(" ")[0];
    return getDaypartGreeting(daypartMode, firstName);
  }, [daypartMode, profile?.full_name]);

  // Handle event click - open in maps or detail
  const handleEventClick = useCallback(async (event: EventWithAttendees) => {
    await hapticImpact("light");
    // Open in maps app for navigation
    const query = encodeURIComponent(event.venue_name || event.title);
    const mapsUrl = `https://maps.google.com/maps?q=${query}`;
    window.open(mapsUrl, "_blank");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative h-screen flex flex-col"
      >
        {/* Map Section - Top 60% with real OpenStreetMap */}
        <div className="relative h-[60vh] bg-muted overflow-hidden">
          {/* Live Interactive Map */}
          <EventMap
            userLocation={userLocation}
            events={events}
            onEventClick={handleEventClick}
            height="100%"
            initialZoom={14}
          />

          {/* Location indicator overlay */}
          <div className="absolute top-safe left-4 right-4 pt-4 z-1000">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-floating border border-border">
              <MapPin size={16} className="text-primary" />
              <span className="text-[14px] font-medium text-foreground">
                {locationPrefs.manualZone || "Current Location"}
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
                {events.length} {events.length === 1 ? "place" : "places"} open
                nearby
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
