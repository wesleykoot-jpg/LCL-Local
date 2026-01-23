import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FloatingNav,
  LoadingSkeleton,
  ErrorBoundary,
} from "@/shared/components/index.ts";
import { useAuth } from "@/features/auth/index.ts";
import { useLocation } from "@/features/location/index.ts";
import { useEventsQuery } from "./hooks/useEventsQuery.ts";
import { useJoinEvent, type EventWithAttendees } from "./hooks/hooks.ts";
import { FeaturedEventHero } from "./components/FeaturedEventHero.tsx";
import { SolidSearchBar } from "./components/SolidSearchBar.tsx";
import { DeepDiveView } from "./components/DeepDiveView.tsx";
import { CategoryPills } from "./components/CategoryPills.tsx";
import { MapPin, Navigation, ChevronDown, Plus } from "lucide-react";
import { useDiscoveryRails } from "./hooks/useDiscoveryRails.ts";
import { IntentPills } from "./components/IntentPills.tsx";
import { MissionModeDrawer } from "./components/MissionModeDrawer.tsx";
import { DynamicRailRenderer } from "./components/DynamicRailRenderer.tsx";
import type { MissionIntent } from "./types/discoveryTypes.ts";
import { hapticImpact } from "@/shared/lib/haptics.ts";

const CreateEventModal = lazy(() =>
  import("./components/CreateEventModal.tsx").then((m) => ({
    default: m.CreateEventModal,
  })),
);
const EventDetailModal = lazy(
  () => import("./components/EventDetailModal.tsx"),
);

// Shared motion animation config for rails
const railMotionConfig = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

/**
 * Discovery Page - Hybrid Intent Model (v5)
 *
 * Rails (in order):
 * 1. "Featured Hero" - Top event
 * 2. "What's Happening Now" (Traditional)
 * 3. "Trending in [City]" (Traditional)
 * 4. "Based on your recent joins" (AI)
 * 5. "The Social Pulse" (AI)
 * 6. "Morning/Evening Vibes" (AI Contextual)
 *
 * Modes:
 * - Browsing: Hybrid rails + Mission Mode triggers
 * - Searching: Deep Dive vertical list
 * - Mission Mode: Bottom drawer for immediate intents
 */
const Discovery = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    location: userLocation,
    preferences: locationPrefs,
    permissionState,
    requestPermission,
  } = useLocation();

  // Mode state
  const [mode, setMode] = useState<"browsing" | "searching">("browsing");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [explicitEvent, setExplicitEvent] = useState<EventWithAttendees | null>(
    null,
  );

  // Mission Mode state
  const [missionIntent, setMissionIntent] = useState<MissionIntent | null>(
    null,
  );
  const [showMissionDrawer, setShowMissionDrawer] = useState(false);

  // 1. Fetch all events for Search/DeepDive (Client-side filtering for now)
  const {
    events: allEvents,
    loading,
    refetch,
  } = useEventsQuery({
    currentUserProfileId: profile?.id,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    usePersonalizedFeed: !!userLocation && !!profile?.id,
  });

  // 2. Fetch Discovery Rails (Client-side generation)
  // Now uses synchronous calculation based on allEvents
  const discoveryLayout = useDiscoveryRails({
    allEvents,
    userId: profile?.id,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    enabled: mode === "browsing",
    // In the future, we can pass profile.interests or similar here
    selectedCategories: [],
  });

  // Rails are "loading" if the source events are loading
  const railsLoading = loading;

  // Debug logging
  useMemo(() => {
    if (import.meta.env.DEV) {
      console.log("[Discovery] Layout Debug:", {
        allEventsLength: allEvents.length,
        firstEvent: allEvents[0],
        railsLoading,
        sectionsCount: discoveryLayout?.sections?.length,
        userLocation,
      });

      if (discoveryLayout?.sections) {
        discoveryLayout.sections.forEach((s, i) => {
          console.log(
            `[Discovery] Rail ${i}: "${s.title}" (${s.items?.length || 0} items)`,
          );
        });
      }
    }
  }, [allEvents, discoveryLayout, railsLoading, userLocation]);

  const { handleJoinEvent: joinEvent, isJoining } = useJoinEvent(
    profile?.id,
    refetch,
  );

  // Featured event (top event with image) - Derived from allTokens or could be first rail item
  const featuredEvent = useMemo(() => {
    return allEvents.find(
      (e) => e.image_url || (e.attendee_count && e.attendee_count > 2),
    );
  }, [allEvents]);

  // Search filtered events (Combined Search + Category)
  const searchFilteredEvents = useMemo(() => {
    let filtered = allEvents;

    // 1. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venue_name?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q),
      );
    }

    // 2. Category Filter
    if (selectedCategory) {
      filtered = filtered.filter(
        (e) => e.category?.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    return filtered;
  }, [allEvents, searchQuery, selectedCategory]);

  // Event handlers
  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  const handleCloseEventDetail = useCallback(() => {
    setSelectedEventId(null);
    setExplicitEvent(null);
  }, []);

  const handleJoinEvent = useCallback(
    async (eventId?: string) => {
      const id = eventId || selectedEventId;
      if (!id) return;
      await joinEvent(id);
      if (!eventId) setSelectedEventId(null);
    },
    [selectedEventId, joinEvent],
  );

  const handleNavigate = useCallback(
    (view: "feed" | "planning" | "profile" | "now") => {
      if (view === "feed") navigate("/");
      else if (view === "profile") navigate("/profile");
      else if (view === "planning") navigate("/planning");
      else if (view === "now") navigate("/now");
    },
    [navigate],
  );

  const handleLocationClick = useCallback(async () => {
    if (permissionState !== "granted") {
      await requestPermission();
    }
  }, [permissionState, requestPermission]);

  const handleSearchFocus = useCallback(() => {
    setMode("searching");
  }, []);

  const handleSearchCancel = useCallback(() => {
    setMode("browsing");
    setSearchQuery("");
    setSelectedCategory(null);
  }, []);

  const handleCategorySelect = useCallback(
    (category: string | null) => {
      setSelectedCategory(category);
      // Auto-switch to searching mode if a category is selected and we are browsing
      if (category && mode === "browsing") {
        setMode("searching");
      }
      // If deselecting and no search query, go back to browsing
      if (!category && !searchQuery && mode === "searching") {
        setMode("browsing");
      }
    },
    [mode, searchQuery],
  );

  // Mission Mode Handlers
  const handleIntentSelect = useCallback((intent: MissionIntent) => {
    setMissionIntent(intent);
    setShowMissionDrawer(true);
  }, []);

  const handleMissionClose = useCallback(() => {
    setShowMissionDrawer(false);
    setTimeout(() => setMissionIntent(null), 300); // Wait for animation
  }, []);

  const selectedEvent = useMemo(() => {
    if (explicitEvent) return explicitEvent;
    if (!selectedEventId) return null;
    return allEvents.find((e) => e.id === selectedEventId) || null;
  }, [selectedEventId, allEvents, explicitEvent]);

  const hasJoinedFeatured = useMemo(() => {
    if (!featuredEvent || !profile?.id) return false;
    return (
      featuredEvent.attendees?.some((a) => a.profile?.id === profile.id) ||
      false
    );
  }, [featuredEvent, profile?.id]);

  // Get location display text
  const locationText = useMemo(() => {
    if (locationPrefs.useGPS && permissionState === "granted") {
      return "Current location";
    }
    return (
      locationPrefs.manualZone || profile?.location_city || "Select location"
    );
  }, [locationPrefs, permissionState, profile?.location_city]);

  return (
    <div className="min-h-screen bg-surface-base text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="pb-32"
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-surface-card shadow-card pt-safe">
          {/* Location row */}
          <div className="px-6 py-3 flex items-center justify-between">
            <button
              onClick={handleLocationClick}
              type="button"
              className="flex items-center gap-2 hover:bg-muted rounded-button py-2 px-3 -ml-3 min-h-[44px] min-w-[44px] transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="Change location"
            >
              {permissionState === "granted" && locationPrefs.useGPS ? (
                <Navigation size={18} className="text-primary" />
              ) : (
                <MapPin size={18} className="text-primary" />
              )}
              <span className="text-[15px] font-semibold text-text-primary">
                {locationText}
              </span>
              <ChevronDown size={16} className="text-text-secondary" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 pb-2">
            <SolidSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onFocus={handleSearchFocus}
              onCancel={handleSearchCancel}
              mode={mode}
              placeholder="Search events, venues, categories..."
            />
          </div>

          {/* Intent Pills - Only visible in browsing mode */}
          <AnimatePresence>
            {mode === "browsing" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pb-3 pt-1">
                  <IntentPills
                    onIntentSelect={handleIntentSelect}
                    selectedIntent={missionIntent}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Pills (New v5.0) */}
          <div className="pb-3 border-t border-border/50 pt-2">
            <CategoryPills
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="overflow-x-hidden">
          <AnimatePresence mode="wait">
            {mode === "browsing" ? (
              <motion.div
                key="browsing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6"
              >
                {/* 1. Featured Hero (Always shown first) */}
                {featuredEvent && (
                  <motion.div className="mb-8 px-4" {...railMotionConfig}>
                    <FeaturedEventHero
                      event={featuredEvent}
                      onEventClick={handleEventClick}
                      onJoinEvent={handleJoinEvent}
                      isJoining={isJoining(featuredEvent.id)}
                      hasJoined={hasJoinedFeatured}
                    />
                  </motion.div>
                )}

                {/* 2. Hybrid Rails (Traditional + Generative) */}
                <ErrorBoundary>
                  {railsLoading ? (
                    <div className="px-6 space-y-8">
                      <LoadingSkeleton className="h-[280px] w-full" />
                      <LoadingSkeleton className="h-[220px] w-full" />
                      <LoadingSkeleton className="h-[220px] w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {discoveryLayout?.sections &&
                      discoveryLayout.sections.length > 0 ? (
                        discoveryLayout.sections.map((section, index) => (
                          <div
                            key={`${section.type}-${section.title}-${index}`}
                            className="mb-8"
                          >
                            <DynamicRailRenderer
                              section={section}
                              onEventClick={handleEventClick}
                              index={index}
                            />
                          </div>
                        ))
                      ) : (
                        /* Fallback/Backup: If no sections returned and not loading, show message */
                        <div className="px-6 py-12 text-center text-muted-foreground bg-surface-card/30 mx-6 rounded-3xl border border-dashed border-border/50">
                          <div className="mb-4 flex justify-center opacity-50">
                            <MapPin size={48} strokeWidth={1.5} />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            No recommendations nearby
                          </h3>
                          <p className="text-sm opacity-70 px-4 max-w-xs mx-auto">
                            We couldn't find any events matching your vibe right
                            now. Try adjusting your search or exploring
                            categories.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </ErrorBoundary>
              </motion.div>
            ) : (
              // SEARCHING MODE (Deep Dive)
              <motion.div
                key="searching"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div className="px-4 py-2">
                  <h2 className="text-xl font-bold mb-4 px-2">
                    {selectedCategory
                      ? `${selectedCategory} Events`
                      : "All Events"}
                  </h2>
                  <DeepDiveView
                    events={searchFilteredEvents}
                    loading={loading}
                    onEventClick={handleEventClick}
                    onJoinEvent={handleJoinEvent}
                    isJoining={isJoining}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Floating Nav */}
        <FloatingNav onNavigate={handleNavigate} activeView="feed" />

        {/* Floating Action Button - Only show in dev mode */}
        {import.meta.env.DEV && (
          <motion.button
            onClick={async () => {
              await hapticImpact("medium");
              setShowCreateModal(true);
            }}
            className="fixed bottom-24 right-5 z-40 w-16 h-16 min-h-[52px] min-w-[52px] rounded-card bg-primary text-primary-foreground flex items-center justify-center mb-safe shadow-floating focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Create new event"
          >
            <Plus size={28} strokeWidth={2.5} />
          </motion.button>
        )}

        {/* Modals & Overlays */}
        <Suspense fallback={null}>
          {showCreateModal && (
            <CreateEventModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
            />
          )}

          <AnimatePresence>
            {selectedEvent && (
              <EventDetailModal
                event={selectedEvent}
                onClose={handleCloseEventDetail}
                // onJoinEvent={() => selectedEvent && handleJoinEvent(selectedEvent.id)}
                isJoining={isJoining(selectedEvent.id)}
              />
            )}
          </AnimatePresence>

          {/* Mission Mode Drawer */}
          {userLocation && (
            <MissionModeDrawer
              isOpen={showMissionDrawer}
              onClose={handleMissionClose}
              intent={missionIntent}
              userLocation={userLocation}
              onEventClick={handleEventClick}
            />
          )}
        </Suspense>
      </motion.div>
    </div>
  );
};

export default Discovery;
