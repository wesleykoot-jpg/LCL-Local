import { useState, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FloatingNav, LoadingSkeleton, ErrorBoundary } from '@/shared/components';
import { useAuth } from '@/features/auth';
import { useLocation } from '@/features/location';
import { useEventsQuery } from './hooks/useEventsQuery';
import { useJoinEvent, type EventWithAttendees } from './hooks/hooks';
import { FeaturedEventHero } from './components/FeaturedEventHero';
import { HorizontalEventCarousel } from './components/HorizontalEventCarousel';
import { FriendsPulseRail } from './components/FriendsPulseRail';
import { DiscoveryRail } from './components/DiscoveryRail';
import { SolidSearchBar } from './components/SolidSearchBar';
import { DeepDiveView } from './components/DeepDiveView';
import { CategoryPills } from './components/CategoryPills';
import { PullToRefresh } from './components/PullToRefresh';
import { groupEventsIntoStacks } from './api/feedGrouping';
import { hapticImpact } from '@/shared/lib/haptics';
import { MapPin, Plus, Navigation, ChevronDown, Flame, Calendar, Zap, RefreshCw } from 'lucide-react';

const CreateEventModal = lazy(() => import('./components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));
const EventDetailModal = lazy(() => import('./components/EventDetailModal'));

// Shared motion animation config for rails
const railMotionConfig = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// Helper to get rail animation with delay
const getRailTransition = (delay: number) => ({
  ...railMotionConfig.transition,
  delay,
});

// Helper to parse event datetime
function parseEventDateTime(dateStr: string, timeStr: string): Date {
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  const timePart = timeStr.split(':');
  const hours = parseInt(timePart[0] || '0', 10);
  const minutes = parseInt(timePart[1] || '0', 10);
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Get "Pulse" events - hot events nearby with high engagement
 * Logic: Events with highest attendee_count, sorted by popularity
 */
function getPulseEvents(events: EventWithAttendees[], limit = 10): EventWithAttendees[] {
  return [...events]
    .sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0))
    .slice(0, limit);
}

/**
 * Get "Tonight" events - events happening between now and 4 AM next day
 * Logic: Filter by time window for spontaneous plans
 */
function getTonightEvents(events: EventWithAttendees[], limit = 10): EventWithAttendees[] {
  const now = new Date();
  const endOfTonight = new Date(now);
  endOfTonight.setDate(endOfTonight.getDate() + 1);
  endOfTonight.setHours(4, 0, 0, 0); // 4 AM next day

  return events
    .filter(e => {
      const eventDateTime = parseEventDateTime(e.event_date, e.event_time);
      return eventDateTime >= now && eventDateTime <= endOfTonight;
    })
    .sort((a, b) => {
      // Sort chronologically
      const dateA = parseEventDateTime(a.event_date, a.event_time);
      const dateB = parseEventDateTime(b.event_date, b.event_time);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, limit);
}

/**
 * Get "Weekend Radar" events - Friday 5 PM through Sunday 11 PM
 * Logic: Filter for weekend planning, sorted chronologically
 */
function getWeekendEvents(events: EventWithAttendees[], limit = 10): EventWithAttendees[] {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay();

  // Calculate Friday 5 PM
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  // If today is Friday, Saturday, or Sunday, use this weekend
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    if (dayOfWeek === 0) {
      // Sunday - show current weekend (Friday was 2 days ago)
      daysUntilFriday = -2;
    } else {
      // Friday or Saturday - use this Friday
      daysUntilFriday = 5 - dayOfWeek;
    }
  }

  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  friday.setHours(17, 0, 0, 0); // 5 PM Friday

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 0, 0, 0); // 11 PM Sunday

  return events
    .filter(e => {
      const eventDateTime = parseEventDateTime(e.event_date, e.event_time);
      return eventDateTime >= friday && eventDateTime <= sunday;
    })
    .sort((a, b) => {
      // Sort chronologically
      const dateA = parseEventDateTime(a.event_date, a.event_time);
      const dateB = parseEventDateTime(b.event_date, b.event_time);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, limit);
}

/**
 * Discovery Page - Time & Location based intent model
 * 
 * Rails (in order):
 * 1. "Pulse of [City]" - Hot events nearby with high engagement
 * 2. "Ritual Rails" - Recurring event stacks (weekly run club, etc.)
 * 3. "The Weekend Radar" - Friday 5PM to Sunday 11PM planning
 * 4. "Tonight" - Spontaneous plans (now to 4AM)
 * 
 * Modes:
 * - Browsing: Horizontal rails with featured hero and time-based sections
 * - Searching: Vertical masonry list with sticky filter bar (Deep Dive)
 */
const Discovery = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs, permissionState, requestPermission } = useLocation();

  // Mode state: browsing (rails) vs searching (deep dive list)
  const [mode, setMode] = useState<'browsing' | 'searching'>('browsing');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [explicitEvent, setExplicitEvent] = useState<EventWithAttendees | null>(null);

  // Ref for scroll container to trigger haptics on rail snaps
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch events
  const { events: allEvents, loading, refetch } = useEventsQuery({
    currentUserProfileId: profile?.id,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    usePersonalizedFeed: !!userLocation && !!profile?.id,
  });

  const { handleJoinEvent: joinEvent, isJoining } = useJoinEvent(profile?.id, refetch);

  // Featured event (top event with image or high attendees - for Pulse hero)
  const featuredEvent = useMemo(() => {
    return allEvents.find(e => e.image_url || (e.attendee_count && e.attendee_count > 2));
  }, [allEvents]);

  // ============================================================
  // RAIL DATA - Derived from single useEventsQuery result
  // ============================================================

  // Rail 1: "Pulse of [City]" - Hot events with high attendee counts
  const pulseEvents = useMemo(() =>
    getPulseEvents(allEvents.filter(e => e.id !== featuredEvent?.id)),
    [allEvents, featuredEvent]
  );

  // Rail 2: "Ritual Rails" - Recurring event stacks
  const ritualsEvents = useMemo(() => {
    const stacks = groupEventsIntoStacks(allEvents);
    // Filter for stacks only (type: 'stack' means has forks attached)
    const recurringStacks = stacks.filter(stack => stack.type === 'stack');
    // Return the anchor events from recurring stacks
    const realEvents = recurringStacks.map(stack => stack.anchor).slice(0, 10);

    // Per requirements: Create mock data to ensure the rail is visible if empty
    // Use events with recurring keywords or categories as placeholders
    if (realEvents.length === 0 && allEvents.length > 0) {
      const potentialRituals = allEvents.filter(e =>
        e.title.toLowerCase().match(/weekly|monthly|club|class|group|meetup/i) ||
        e.category === 'sports' || e.category === 'wellness'
      ).slice(0, 3);

      // Fallback to any events if no matches found
      return potentialRituals.length > 0 ? potentialRituals : allEvents.slice(0, 3);
    }

    return realEvents;
  }, [allEvents]);

  // Rail 3: "The Weekend Radar" - Friday 5PM to Sunday 11PM
  const weekendEvents = useMemo(() =>
    getWeekendEvents(allEvents.filter(e => e.id !== featuredEvent?.id)),
    [allEvents, featuredEvent]
  );

  // Rail 4: "Tonight" - Events from now to 4AM next day
  const tonightEvents = useMemo(() =>
    getTonightEvents(allEvents.filter(e => e.id !== featuredEvent?.id)),
    [allEvents, featuredEvent]
  );

  // Search filtered events (Combined Search + Category)
  const searchFilteredEvents = useMemo(() => {
    let filtered = allEvents;

    // 1. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (selectedCategory) {
      filtered = filtered.filter(e =>
        e.category?.toLowerCase() === selectedCategory.toLowerCase()
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

  const handleJoinEvent = useCallback(async (eventId?: string) => {
    const id = eventId || selectedEventId;
    if (!id) return;
    await joinEvent(id);
    if (!eventId) setSelectedEventId(null);
  }, [selectedEventId, joinEvent]);

  const handleNavigate = useCallback((view: 'feed' | 'planning' | 'profile' | 'now') => {
    if (view === 'feed') navigate('/');
    else if (view === 'profile') navigate('/profile');
    else if (view === 'planning') navigate('/planning');
    else if (view === 'now') navigate('/now');
  }, [navigate]);

  const handleLocationClick = useCallback(async () => {
    if (permissionState !== 'granted') {
      await requestPermission();
    }
  }, [permissionState, requestPermission]);

  const handleSearchFocus = useCallback(() => {
    setMode('searching');
  }, []);

  const handleSearchCancel = useCallback(() => {
    setMode('browsing');
    setSearchQuery('');
    setSelectedCategory(null);
  }, []);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
    // Auto-switch to searching mode if a category is selected and we are browsing
    if (category && mode === 'browsing') {
      setMode('searching');
    }
    // If deselecting and no search query, go back to browsing
    if (!category && !searchQuery && mode === 'searching') {
      setMode('browsing');
    }
  }, [mode, searchQuery]);

  const selectedEvent = useMemo(() => {
    if (explicitEvent) return explicitEvent;
    if (!selectedEventId) return null;
    return allEvents.find(e => e.id === selectedEventId) || null;
  }, [selectedEventId, allEvents, explicitEvent]);

  const hasJoinedFeatured = useMemo(() => {
    if (!featuredEvent || !profile?.id) return false;
    return featuredEvent.attendees?.some(a => a.profile?.id === profile.id) || false;
  }, [featuredEvent, profile?.id]);

  // Get location display text
  const locationText = useMemo(() => {
    if (locationPrefs.useGPS && permissionState === 'granted') {
      return 'Current location';
    }
    return locationPrefs.manualZone || profile?.location_city || 'Select location';
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
        <header className="sticky top-0 z-40 bg-surface-card shadow-card border-b border-border pt-safe">
          {/* Location row */}
          <div className="px-6 py-3 flex items-center justify-between">
            <button
              onClick={handleLocationClick}
              className="flex items-center gap-2 hover:bg-muted rounded-button py-2 px-3 -ml-3 min-h-[44px] min-w-[44px] transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="Change location"
            >
              {permissionState === 'granted' && locationPrefs.useGPS ? (
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
          <div className="px-6 pb-4">
            <SolidSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onFocus={handleSearchFocus}
              onCancel={handleSearchCancel}
              mode={mode}
              placeholder="Search events, venues, categories..."
            />
          </div>

          {/* Category Pills (New v5.0) */}
          <div className="pb-3">
            <CategoryPills
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="overflow-x-hidden">
          <AnimatePresence mode="wait">
            {mode === 'browsing' ? (
              <motion.div
                key="browsing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6"
              >
                {loading ? (
                  <div className="px-6">
                    <LoadingSkeleton />
                  </div>
                ) : allEvents.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 px-6"
                  >
                    <p className="text-muted-foreground text-[17px]">No events found</p>
                    <p className="text-muted-foreground/60 text-[15px] mt-2">
                      Try changing your location or check back later
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-6" ref={scrollContainerRef}>
                    {/* Featured Hero - Contextual top event */}
                    {featuredEvent && (
                      <motion.div
                        className="mb-6 px-4"
                        {...railMotionConfig}
                      >
                        <FeaturedEventHero
                          event={featuredEvent}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          isJoining={isJoining(featuredEvent.id)}
                          hasJoined={hasJoinedFeatured}
                        />
                      </motion.div>
                    )}

                    {/* Friends Pulse Rail */}
                    <div className="mb-6">
                      <FriendsPulseRail
                        currentUserProfileId={profile?.id}
                        onEventClick={handleEventClick}
                      />
                    </div>

                    {/* Rail 1: Pulse of [City] - Hot events nearby */}
                    {pulseEvents.length > 0 && (
                      <motion.div
                        className="mb-6"
                        initial={railMotionConfig.initial}
                        animate={railMotionConfig.animate}
                        transition={getRailTransition(0.1)}
                      >
                        <DiscoveryRail
                          title={
                            <span className="flex items-center gap-2">
                              <Flame size={20} className="text-orange-500" />
                              Pulse of {locationPrefs.manualZone || profile?.location_city || 'Your City'}
                            </span>
                          }
                        >
                          <HorizontalEventCarousel
                            title=""
                            events={pulseEvents}
                            onEventClick={handleEventClick}
                            onJoinEvent={handleJoinEvent}
                            joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                            currentUserProfileId={profile?.id}
                          />
                        </DiscoveryRail>
                      </motion.div>
                    )}

                    {/* Rail 2: Ritual Rails - Recurring event stacks */}
                    {ritualsEvents.length > 0 && (
                      <motion.div
                        className="mb-6"
                        initial={railMotionConfig.initial}
                        animate={railMotionConfig.animate}
                        transition={getRailTransition(0.15)}
                      >
                        <DiscoveryRail
                          title={
                            <span className="flex items-center gap-2">
                              <RefreshCw size={20} className="text-green-500" />
                              Ritual Rails
                            </span>
                          }
                        >
                          <HorizontalEventCarousel
                            title=""
                            events={ritualsEvents}
                            onEventClick={handleEventClick}
                            onJoinEvent={handleJoinEvent}
                            joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                            currentUserProfileId={profile?.id}
                          />
                        </DiscoveryRail>
                      </motion.div>
                    )}

                    {/* Rail 3: The Weekend Radar - Planning for upcoming weekend */}
                    {weekendEvents.length > 0 && (
                      <motion.div
                        className="mb-6"
                        initial={railMotionConfig.initial}
                        animate={railMotionConfig.animate}
                        transition={getRailTransition(0.2)}
                      >
                        <DiscoveryRail
                          title={
                            <span className="flex items-center gap-2">
                              <Calendar size={20} className="text-blue-500" />
                              The Weekend Radar
                            </span>
                          }
                        >
                          <HorizontalEventCarousel
                            title=""
                            events={weekendEvents}
                            onEventClick={handleEventClick}
                            onJoinEvent={handleJoinEvent}
                            joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                            currentUserProfileId={profile?.id}
                          />
                        </DiscoveryRail>
                      </motion.div>
                    )}

                    {/* Rail 4: Tonight - Spontaneous last-minute plans */}
                    {tonightEvents.length > 0 && (
                      <motion.div
                        className="mb-6"
                        initial={railMotionConfig.initial}
                        animate={railMotionConfig.animate}
                        transition={getRailTransition(0.25)}
                      >
                        <DiscoveryRail
                          title={
                            <span className="flex items-center gap-2">
                              <Zap size={20} className="text-yellow-500" />
                              Tonight
                            </span>
                          }
                        >
                          <HorizontalEventCarousel
                            title=""
                            events={tonightEvents}
                            onEventClick={handleEventClick}
                            onJoinEvent={handleJoinEvent}
                            joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                            currentUserProfileId={profile?.id}
                          />
                        </DiscoveryRail>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="searching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DeepDiveView
                  events={searchFilteredEvents}
                  onEventClick={handleEventClick}
                  onJoinEvent={handleJoinEvent}
                  isJoining={isJoining}
                  currentUserProfileId={profile?.id}
                  loading={loading}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Floating Action Button - Only show in dev mode */}
      {import.meta.env.DEV && (
        <motion.button
          onClick={async () => {
            await hapticImpact('medium');
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

      <FloatingNav activeView="feed" onNavigate={handleNavigate} />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <ErrorBoundary>
          <Suspense fallback={<div className="fixed inset-0 bg-black/50  z-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
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
          <Suspense fallback={<div className="fixed inset-0 bg-black/50  z-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
            <CreateEventModal
              onClose={() => setShowCreateModal(false)}
              defaultEventType="anchor"
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Discovery;
