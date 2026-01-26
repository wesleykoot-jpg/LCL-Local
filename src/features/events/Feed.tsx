import { useState, lazy, Suspense, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FloatingNav,
  LoadingSkeleton,
  ErrorBoundary,
  DevPanel,
} from "@/shared/components";
import { OnboardingWizard } from "@/features/profile";
import { FeaturedEventHero } from "./components/FeaturedEventHero";
import { HorizontalEventCarousel } from "./components/HorizontalEventCarousel";
import { EventStackCard } from "./components/EventStackCard";
import { TimeFilterPills, type TimeFilter } from "./components/TimeFilterPills";
import { PullToRefresh } from "./components/PullToRefresh";
import { useOnboarding } from "@/features/profile";
import { useAuth } from "@/features/auth";
import { useLocation } from "@/features/location";
import {
  MapPin,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  Navigation,
  Sparkles,
} from "lucide-react";
import { useEventsQuery } from "./hooks/useEventsQuery";
import { useJoinEvent, type EventWithAttendees } from "./hooks/hooks";
import { useDiscoveryRails } from "./hooks/useDiscoveryRails";
import { hapticImpact } from "@/shared/lib/haptics";
import { groupEventsIntoStacks } from "./api/feedGrouping";
import { rankEvents } from "./api/feedAlgorithm";
import { trackEventView, trackEventJoin } from "./api/interestTracking";
import { useFeedMode } from "@/contexts/FeedContext";

const CreateEventModal = lazy(() =>
  import("./components/CreateEventModal").then((m) => ({
    default: m.CreateEventModal,
  })),
);
const EventDetailModal = lazy(() => import("./components/EventDetailModal"));

// Helper to parse date as local
function parseLocalDate(dateString: string): Date {
  const datePart = dateString.split("T")[0].split(" ")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Filter events by time
function filterEventsByTime(
  events: EventWithAttendees[],
  filter: TimeFilter,
): EventWithAttendees[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filter) {
    case "tonight":
      return events.filter((e) => {
        if (!e.event_date) return false;
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === today.getTime();
      });
    case "tomorrow": {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return events.filter((e) => {
        if (!e.event_date) return false;
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === tomorrow.getTime();
      });
    }
    case "weekend": {
      const dayOfWeek = today.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);
      return events.filter((e) => {
        if (!e.event_date) return false;
        const eventDay = parseLocalDate(e.event_date);
        return eventDay >= friday && eventDay <= sunday;
      });
    }
    case "all":
    default:
      return events;
  }
}

const Feed = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    location: userLocation,
    preferences: locationPrefs,
    permissionState,
  } = useLocation();
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [explicitEvent, setExplicitEvent] = useState<EventWithAttendees | null>(
    null,
  );
  const [forkParentEvent, setForkParentEvent] =
    useState<EventWithAttendees | null>(null);
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("all");

  const { handleJoinEvent: joinEvent, isJoining } = useJoinEvent(
    profile?.id,
    refetch,
  );
  const { feedMode, isParentDetected, setIsParentDetected } = useFeedMode();

  const {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    isLoaded,
  } = useOnboarding();

  // Combine onboarding preferences with location and feed mode for feed algorithm
  const feedPreferences = useMemo(() => {
    if (!preferences) return null;
    return {
      ...preferences,
      userLocation,
      radiusKm: locationPrefs.radiusKm,
      feedMode,
      isParentDetected,
    };
  }, [
    preferences,
    userLocation,
    locationPrefs.radiusKm,
    feedMode,
    isParentDetected,
  ]);

  // Filter and rank events
  const filteredEvents = useMemo(() => {
    return filterEventsByTime(allEvents, activeFilter);
  }, [allEvents, activeFilter]);

  const rankedEvents = useMemo(() => {
    return rankEvents(
      filteredEvents as unknown as any[],
      feedPreferences || null,
      {
        ensureDiversity: true,
        debug: false,
      },
    ) as unknown as EventWithAttendees[];
  }, [filteredEvents, feedPreferences]);

  // Featured event (top ranked with image)
  const featuredEvent = useMemo(() => {
    return rankedEvents.find(
      (e) => e.image_url || (e.attendee_count && e.attendee_count > 2),
    );
  }, [rankedEvents]);

  // Remaining events as stacks
  const remainingStacks = useMemo(() => {
    const excludeIds = new Set(
      [featuredEvent?.id, ...rankedEvents.slice(0, 5).map((e) => e.id)].filter(
        Boolean,
      ) as string[],
    );

    const remaining = rankedEvents.filter((e) => !excludeIds.has(e.id));
    return groupEventsIntoStacks(remaining as any);
  }, [rankedEvents, featuredEvent]);

  // Use Discovery Rails Strategy
  const { sections } = useDiscoveryRails({
    allEvents: filteredEvents, // Use filtered events (based on time filter)
    enabled: activeFilter === "all", // Only show rails on 'all' view
    selectedCategories: preferences?.selectedCategories,
    // bookmarkedEvents: [], // TODO: Add bookmark hook
    locationCity: profile?.location_city || "Meppel",
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    profileId: profile?.id,
  });

  const handleNavigate = (view: "feed" | "planning" | "profile" | "now") => {
    if (view === "feed") navigate("/");
    else if (view === "profile") navigate("/profile");
    else if (view === "planning") navigate("/planning");
    else if (view === "now") navigate("/now");
  };

  const handleEventClick = useCallback(
    async (eventId: string) => {
      setSelectedEventId(eventId);

      // Track event view for interest scoring
      if (profile?.id) {
        const event = allEvents.find((e) => e.id === eventId);
        if (event) {
          const result = await trackEventView(profile.id, event.category);
          if (result.isParentDetected && !isParentDetected) {
            setIsParentDetected(true);
          }
        }
      }
    },
    [allEvents, profile?.id, isParentDetected, setIsParentDetected],
  );

  const handleCloseEventDetail = () => {
    setSelectedEventId(null);
    setExplicitEvent(null);
  };

  const handleLocationClick = async () => {
    await hapticImpact("light");
    // Open onboarding wizard to allow location change
    setShowOnboarding(true);
  };

  const selectedEvent = useMemo(() => {
    if (explicitEvent) return explicitEvent;
    if (!selectedEventId) return null;
    return allEvents.find((e) => e.id === selectedEventId) || null;
  }, [selectedEventId, allEvents, explicitEvent]);

  const handleJoinEvent = useCallback(
    async (eventId?: string) => {
      const id = eventId || selectedEventId;
      if (!id) return;
      await joinEvent(id);
      if (!eventId) setSelectedEventId(null);

      // Track event join for interest scoring (higher weight)
      if (profile?.id) {
        const event = allEvents.find((e) => e.id === id);
        if (event) {
          const result = await trackEventJoin(profile.id, event.category);
          if (result.isParentDetected && !isParentDetected) {
            setIsParentDetected(true);
          }
        }
      }
    },
    [
      selectedEventId,
      joinEvent,
      allEvents,
      profile?.id,
      isParentDetected,
      setIsParentDetected,
    ],
  );

  const handleForkEvent = useCallback(
    (eventId: string) => {
      const event = allEvents.find((e) => e.id === eventId);
      if (event) {
        setForkParentEvent(event);
        setShowCreateModal(true);
      }
    },
    [allEvents],
  );

  const hasJoinedFeatured = useMemo(() => {
    if (!featuredEvent || !profile?.id) return false;
    return (
      featuredEvent.attendees?.some((a) => a.profile?.id === profile.id) ||
      false
    );
  }, [featuredEvent, profile?.id]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="pb-32"
        >
          {/* Header - Airbnb-style clean */}
          <header className="sticky top-0 z-40 bg-card border-b border-border pt-safe">
            {/* Location row */}
            <div className="px-5 py-3 flex items-center justify-between">
              {/* Location as primary element */}
              <button
                onClick={handleLocationClick}
                className="flex items-center gap-2 hover:bg-muted rounded-xl py-2 px-3 -ml-3 min-h-[44px] transition-all active:scale-[0.98]"
              >
                {permissionState === "granted" && locationPrefs.useGPS ? (
                  <Navigation size={18} className="text-primary" />
                ) : (
                  <MapPin size={18} className="text-primary" />
                )}
                <span className="text-[15px] font-semibold text-foreground">
                  {locationPrefs.useGPS && permissionState === "granted"
                    ? "Current location"
                    : preferences?.zone ||
                      locationPrefs.manualZone ||
                      profile?.location_city ||
                      "Meppel, NL"}
                </span>
                <ChevronDown size={16} className="text-muted-foreground" />
              </button>

              {/* Filter button */}
              <button
                onClick={async () => {
                  await hapticImpact("light");
                  setShowOnboarding(true);
                }}
                className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-[0.95]"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>

            {/* Filter pills */}
            <div className="px-4 pb-3">
              <TimeFilterPills
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />
            </div>
          </header>

          {/* Main Content - Netflix/Airbnb hybrid layout */}
          <main className="px-4 pt-4 space-y-6 overflow-x-hidden">
            {loading ? (
              <div className="max-w-md mx-auto flex flex-col gap-5">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="aspect-[4/3] bg-muted/50 rounded-[2rem]"
                    animate={{ opacity: [0.4, 0.6, 0.4] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            ) : rankedEvents.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <p className="text-muted-foreground text-[17px]">
                  Geen evenementen gevonden
                </p>
                <p className="text-muted-foreground/60 text-[15px] mt-2">
                  Probeer een ander filter te selecteren
                </p>
              </motion.div>
            ) : (
              <>
                {/* Featured Hero - Only on 'all' filter */}
                {activeFilter === "all" && featuredEvent && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <FeaturedEventHero
                      event={featuredEvent}
                      onEventClick={handleEventClick}
                      onJoinEvent={handleJoinEvent}
                      isJoining={isJoining(featuredEvent.id)}
                      hasJoined={hasJoinedFeatured}
                      onFork={handleForkEvent}
                    />
                  </motion.div>
                )}

                {/* Discovery Rails (Dynamic Strategy) */}
                {/* Rails include: Pulse, Location, Rituals, This Weekend, etc. */}
                <div className="space-y-6 mt-6">
                  {sections.map((section, index) => {
                    // Show all rails, even if empty, for better discovery
                    return (
                      <motion.div
                        key={section.title + index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <HorizontalEventCarousel
                          title={section.title}
                          events={section.items}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          joiningEventId={
                            allEvents.find((e) => isJoining(e.id))?.id
                          }
                          currentUserProfileId={profile?.id}
                        />
                      </motion.div>
                    );
                  })}

                  {/* Fallback to Stacks for "All Events" after rails */}
                  {remainingStacks.length > 0 && (
                    <div className="space-y-5 pt-4">
                      <div className="flex items-center gap-2 px-1">
                        <Sparkles size={18} className="text-primary" />
                        <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                          Alle evenementen
                        </h2>
                      </div>
                      <div className="max-w-md mx-auto w-full flex flex-col gap-6">
                        {remainingStacks.map((stack) => (
                          <EventStackCard
                            key={stack.anchor.id}
                            stack={stack}
                            onEventClick={handleEventClick}
                            onJoinEvent={handleJoinEvent}
                            onFork={handleForkEvent}
                            joiningEventId={
                              allEvents.find((e) => isJoining(e.id))?.id
                            }
                            currentUserProfileId={profile?.id}
                            userLocation={
                              userLocation ||
                              locationPrefs.manualCoordinates ||
                              null
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </motion.div>

        {/* Floating Action Button - Thumb zone */}
        <motion.button
          onClick={async () => {
            await hapticImpact("medium");
            setShowCreateModal(true);
          }}
          className="fixed bottom-24 right-5 z-40 w-16 h-16 min-h-[52px] min-w-[52px] rounded-[1.5rem] bg-primary text-primary-foreground flex items-center justify-center mb-safe border-[0.5px] border-primary/20"
          style={{
            boxShadow:
              "0 8px 24px -4px rgba(var(--primary) / 0.3), 0 16px 40px -8px rgba(0, 0, 0, 0.15)",
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </motion.button>

        <FloatingNav activeView="feed" onNavigate={handleNavigate} />

        <DevPanel onRefetchEvents={refetch} />

        {/* Onboarding Wizard */}
        <AnimatePresence>
          {showOnboarding && (
            <OnboardingWizard
              onComplete={completeOnboarding}
              onClose={() => setShowOnboarding(false)}
            />
          )}
        </AnimatePresence>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="fixed inset-0 bg-black/50  z-50 flex items-center justify-center">
                  <LoadingSkeleton />
                </div>
              }
            >
              <EventDetailModal
                event={selectedEvent}
                onClose={handleCloseEventDetail}
                onJoin={() => handleJoinEvent()}
                isJoining={isJoining(selectedEventId || selectedEvent.id)}
                currentUserProfileId={profile?.id}
                onEventSelect={(event) => setExplicitEvent(event)}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Create Event Modal */}
        {showCreateModal && (
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="fixed inset-0 bg-black/50  z-50 flex items-center justify-center">
                  <LoadingSkeleton />
                </div>
              }
            >
              <CreateEventModal
                onClose={() => {
                  setShowCreateModal(false);
                  setForkParentEvent(null);
                }}
                defaultEventType="anchor"
                initialParentEvent={forkParentEvent || undefined}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </PullToRefresh>
  );
};

export default Feed;
