import { useState, lazy, Suspense, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FloatingNav } from '@/components/FloatingNav';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { DevPanel } from '@/components/DevPanel';
import { FeaturedEventHero } from '@/components/FeaturedEventHero';
import { HorizontalEventCarousel } from '@/components/HorizontalEventCarousel';
import { EventStackCard } from '@/components/EventStackCard';
import { TimeFilterPills, type TimeFilter } from '@/components/TimeFilterPills';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/useAuth';
import { useLocation } from '@/contexts/LocationContext';
import { MapPin, Plus, SlidersHorizontal, ChevronDown, Navigation, Sparkles } from 'lucide-react';
import { useEvents, useJoinEvent } from '@/lib/hooks';
import { hapticImpact } from '@/lib/haptics';
import { groupEventsIntoStacks } from '@/lib/feedGrouping';
import { rankEvents } from '@/lib/feedAlgorithm';
import { CATEGORY_MAP } from '@/lib/categories';
import type { EventWithAttendees } from '@/lib/hooks';

const CreateEventModal = lazy(() => import('@/components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));
const EventDetailModal = lazy(() => import('@/components/EventDetailModal'));

// Helper to parse date as local
function parseLocalDate(dateString: string): Date {
  const datePart = dateString.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Filter events by time
function filterEventsByTime(events: EventWithAttendees[], filter: TimeFilter): EventWithAttendees[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (filter) {
    case 'tonight':
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === today.getTime();
      });
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === tomorrow.getTime();
      });
    case 'weekend':
      const dayOfWeek = today.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return eventDay >= friday && eventDay <= sunday;
      });
    case 'all':
    default:
      return events;
  }
}

// Group events by category for carousels
function groupEventsByCategory(events: EventWithAttendees[]): Map<string, EventWithAttendees[]> {
  const groups = new Map<string, EventWithAttendees[]>();
  
  events.forEach(event => {
    const category = CATEGORY_MAP[event.category] || event.category;
    const existing = groups.get(category) || [];
    existing.push(event);
    groups.set(category, existing);
  });
  
  return groups;
}

// Get trending events (most attendees)
function getTrendingEvents(events: EventWithAttendees[], limit = 6): EventWithAttendees[] {
  return [...events]
    .sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0))
    .slice(0, limit);
}

// Get upcoming events (within 2 days)
function getUpcomingEvents(events: EventWithAttendees[], limit = 6): EventWithAttendees[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysLater = new Date(today);
  twoDaysLater.setDate(today.getDate() + 2);
  
  return events
    .filter(e => {
      const eventDay = parseLocalDate(e.event_date);
      return eventDay >= today && eventDay <= twoDaysLater;
    })
    .slice(0, limit);
}

const Feed = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs, permissionState, requestPermission } = useLocation();
  const { events: allEvents, loading, refetch } = useEvents({ currentUserProfileId: profile?.id });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('all');
  
  const { handleJoinEvent: joinEvent, isJoining } = useJoinEvent(profile?.id, refetch);
  
  const {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    isLoaded,
  } = useOnboarding();

  // Combine onboarding preferences with location for feed algorithm
  const feedPreferences = useMemo(() => {
    if (!preferences) return null;
    return {
      ...preferences,
      userLocation,
      radiusKm: locationPrefs.radiusKm,
    };
  }, [preferences, userLocation, locationPrefs.radiusKm]);

  // Filter and rank events
  const filteredEvents = useMemo(() => {
    return filterEventsByTime(allEvents, activeFilter);
  }, [allEvents, activeFilter]);

  const rankedEvents = useMemo(() => {
    return rankEvents(filteredEvents, feedPreferences || null, {
      ensureDiversity: true,
      debug: false,
    });
  }, [filteredEvents, feedPreferences]);

  // Featured event (top ranked with image)
  const featuredEvent = useMemo(() => {
    return rankedEvents.find(e => e.image_url || e.attendee_count && e.attendee_count > 2);
  }, [rankedEvents]);

  // Trending events for carousel
  const trendingEvents = useMemo(() => {
    return getTrendingEvents(rankedEvents.filter(e => e.id !== featuredEvent?.id));
  }, [rankedEvents, featuredEvent]);

  // Upcoming events for carousel
  const upcomingEvents = useMemo(() => {
    return getUpcomingEvents(rankedEvents.filter(e => e.id !== featuredEvent?.id));
  }, [rankedEvents, featuredEvent]);

  // Remaining events as stacks
  const remainingStacks = useMemo(() => {
    const excludeIds = new Set([
      featuredEvent?.id,
      ...trendingEvents.map(e => e.id),
    ].filter(Boolean) as string[]);
    
    const remaining = rankedEvents.filter(e => !excludeIds.has(e.id));
    return groupEventsIntoStacks(remaining);
  }, [rankedEvents, featuredEvent, trendingEvents]);

  const handleNavigate = (view: 'feed' | 'profile' | 'my-events') => {
    if (view === 'feed') navigate('/feed');
    else if (view === 'profile') navigate('/profile');
    else if (view === 'my-events') navigate('/my-events');
  };

  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleCloseEventDetail = () => {
    setSelectedEventId(null);
  };

  const handleLocationClick = async () => {
    if (permissionState !== 'granted') {
      await requestPermission();
    }
  };

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return allEvents.find(e => e.id === selectedEventId) || null;
  }, [selectedEventId, allEvents]);

  const handleJoinEvent = useCallback(async (eventId?: string) => {
    const id = eventId || selectedEventId;
    if (!id) return;
    await joinEvent(id);
    if (!eventId) setSelectedEventId(null);
  }, [selectedEventId, joinEvent]);

  const hasJoinedFeatured = useMemo(() => {
    if (!featuredEvent || !profile?.id) return false;
    return featuredEvent.attendees?.some(a => a.profile?.id === profile.id) || false;
  }, [featuredEvent, profile?.id]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="pb-32"
      >
        {/* Header - Airbnb-inspired with safe area */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-[0.5px] border-border/30 pt-safe">
          <div className="px-5 py-4 flex items-center justify-between">
            {/* Location as primary element - 44pt touch target */}
            <button 
              onClick={handleLocationClick}
              className="flex items-center gap-2.5 hover:bg-muted/50 rounded-[1.25rem] py-2.5 px-3.5 -ml-3.5 min-h-[48px] transition-all active:scale-[0.98]"
            >
              {permissionState === 'granted' && locationPrefs.useGPS ? (
                <Navigation size={20} className="text-primary" />
              ) : (
                <MapPin size={20} className="text-primary" />
              )}
              <span className="text-[17px] font-semibold text-foreground tracking-tight">
                {locationPrefs.useGPS && permissionState === 'granted' 
                  ? 'Huidige locatie' 
                  : preferences?.zone || locationPrefs.manualZone || profile?.location_city || 'Meppel, NL'}
              </span>
              <ChevronDown size={18} className="text-muted-foreground" />
            </button>
            
            {/* Filter button - 44pt touch target with squircle */}
            <button 
              onClick={async () => {
                await hapticImpact('light');
                setShowOnboarding(true);
              }}
              className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-[1.25rem] bg-card border-[0.5px] border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all active:scale-[0.95]"
              style={{
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.06)'
              }}
            >
              <SlidersHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* Main Content - Netflix/Airbnb hybrid layout */}
        <main className="px-4 pt-5 space-y-8 overflow-x-hidden">
          {/* Time Filter Pills */}
          <div className="sticky top-[72px] z-30 bg-background/80 backdrop-blur-xl -mx-4 px-4 py-3">
            <TimeFilterPills
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </div>

          {loading ? (
            <div className="max-w-md mx-auto flex flex-col gap-5">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="aspect-[4/3] bg-muted/50 rounded-[2rem]"
                  animate={{ opacity: [0.4, 0.6, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.15 }}
                />
              ))}
            </div>
          ) : rankedEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-muted-foreground text-[17px]">Geen evenementen gevonden</p>
              <p className="text-muted-foreground/60 text-[15px] mt-2">Probeer een ander filter te selecteren</p>
            </motion.div>
          ) : (
            <>
              {/* Featured Hero - Only on 'all' filter */}
              {activeFilter === 'all' && featuredEvent && (
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
                  />
                </motion.div>
              )}

              {/* Trending Carousel */}
              {activeFilter === 'all' && trendingEvents.length > 0 && (
                <HorizontalEventCarousel
                  title="🔥 Populair in Meppel"
                  events={trendingEvents}
                  onEventClick={handleEventClick}
                  onJoinEvent={handleJoinEvent}
                  joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                  currentUserProfileId={profile?.id}
                />
              )}

              {/* Upcoming Carousel */}
              {activeFilter === 'all' && upcomingEvents.length > 0 && (
                <HorizontalEventCarousel
                  title="⚡ Binnenkort"
                  events={upcomingEvents}
                  onEventClick={handleEventClick}
                  onJoinEvent={handleJoinEvent}
                  joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                  currentUserProfileId={profile?.id}
                />
              )}

              {/* All Events Section */}
              {remainingStacks.length > 0 && (
                <div className="space-y-5">
                  {activeFilter === 'all' && (
                    <div className="flex items-center gap-2 px-1">
                      <Sparkles size={18} className="text-primary" />
                      <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                        Alle evenementen
                      </h2>
                    </div>
                  )}
                  
                  <div className="max-w-md mx-auto w-full flex flex-col gap-6">
                    {remainingStacks.map((stack) => (
                      <motion.div
                        key={stack.anchor.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <EventStackCard
                          stack={stack}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                          currentUserProfileId={profile?.id}
                          userLocation={userLocation || locationPrefs.manualCoordinates || null}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </motion.div>

      {/* Floating Action Button - Thumb zone */}
      <motion.button
        onClick={async () => {
          await hapticImpact('medium');
          setShowCreateModal(true);
        }}
        className="fixed bottom-28 right-5 z-40 w-16 h-16 min-h-[52px] min-w-[52px] rounded-[1.5rem] bg-primary text-primary-foreground flex items-center justify-center mb-safe border-[0.5px] border-primary/20"
        style={{
          boxShadow: '0 8px 24px -4px rgba(var(--primary) / 0.3), 0 16px 40px -8px rgba(0, 0, 0, 0.15)'
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
          <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
            <EventDetailModal
              event={selectedEvent as any}
              onClose={handleCloseEventDetail}
              onJoin={() => handleJoinEvent()}
              isJoining={isJoining(selectedEventId || '')}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <ErrorBoundary>
          <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
            <CreateEventModal
              onClose={() => setShowCreateModal(false)}
              defaultCategory="social"
              defaultEventType="anchor"
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Feed;
