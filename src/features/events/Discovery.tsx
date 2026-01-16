import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
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
import { GlassSearchBar } from './components/GlassSearchBar';
import { DeepDiveView } from './components/DeepDiveView';
import { hapticImpact } from '@/shared/lib/haptics';
import { MapPin, Plus, Navigation, ChevronDown } from 'lucide-react';

const CreateEventModal = lazy(() => import('./components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));
const EventDetailModal = lazy(() => import('./components/EventDetailModal'));

// Helper to parse date as local
function parseLocalDate(dateString: string): Date {
  const datePart = dateString.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get events by date filter
function filterByDate(events: EventWithAttendees[], filter: 'today' | 'weekend' | 'all'): EventWithAttendees[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (filter) {
    case 'today':
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === today.getTime();
      });
    case 'weekend': {
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
    }
    case 'all':
    default:
      return events;
  }
}

// Get popular events (most attendees)
function getPopularEvents(events: EventWithAttendees[], limit = 10): EventWithAttendees[] {
  return [...events]
    .sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0))
    .slice(0, limit);
}

// Get today's events
function getTonightEvents(events: EventWithAttendees[], limit = 10): EventWithAttendees[] {
  return filterByDate(events, 'today').slice(0, limit);
}

// Get weekend events
function getWeekendEvents(events: EventWithAttendees[], limit = 10): EventWithAttendees[] {
  return filterByDate(events, 'weekend').slice(0, limit);
}

// Get events by category
function getEventsByCategory(events: EventWithAttendees[], category: string, limit = 10): EventWithAttendees[] {
  return events
    .filter(e => e.category === category)
    .slice(0, limit);
}

/**
 * Discovery Page - Airbnb-inspired event discovery with dual-mode logic
 * 
 * Modes:
 * - Browsing: Horizontal rails with featured hero, popular, weekend, tonight, nearby, music sections
 * - Searching: Vertical masonry list with sticky filter bar
 */
const Discovery = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs, permissionState, requestPermission } = useLocation();
  
  // Mode state: browsing (rails) vs searching (deep dive list)
  const [mode, setMode] = useState<'browsing' | 'searching'>('browsing');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Fetch events
  const { events: allEvents, loading, refetch } = useEventsQuery({ 
    currentUserProfileId: profile?.id,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs.radiusKm,
    usePersonalizedFeed: !!userLocation && !!profile?.id,
  });
  
  const { handleJoinEvent: joinEvent, isJoining } = useJoinEvent(profile?.id, refetch);

  // Featured event (top event with image or high attendees)
  const featuredEvent = useMemo(() => {
    return allEvents.find(e => e.image_url || (e.attendee_count && e.attendee_count > 2));
  }, [allEvents]);

  // Rail data
  const popularEvents = useMemo(() => 
    getPopularEvents(allEvents.filter(e => e.id !== featuredEvent?.id)), 
    [allEvents, featuredEvent]
  );

  const weekendEvents = useMemo(() => 
    getWeekendEvents(allEvents.filter(e => e.id !== featuredEvent?.id)), 
    [allEvents, featuredEvent]
  );

  const tonightEvents = useMemo(() => 
    getTonightEvents(allEvents.filter(e => e.id !== featuredEvent?.id)), 
    [allEvents, featuredEvent]
  );

  const musicEvents = useMemo(() => 
    getEventsByCategory(allEvents.filter(e => e.id !== featuredEvent?.id), 'music'), 
    [allEvents, featuredEvent]
  );

  // Search filtered events
  const searchFilteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return allEvents;
    const q = searchQuery.toLowerCase();
    return allEvents.filter(e => 
      e.title.toLowerCase().includes(q) ||
      e.venue_name?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  }, [allEvents, searchQuery]);

  // Event handlers
  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  const handleCloseEventDetail = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  const handleJoinEvent = useCallback(async (eventId?: string) => {
    const id = eventId || selectedEventId;
    if (!id) return;
    await joinEvent(id);
    if (!eventId) setSelectedEventId(null);
  }, [selectedEventId, joinEvent]);

  const handleNavigate = useCallback((view: 'feed' | 'planning' | 'profile' | 'scraper') => {
    if (view === 'feed') navigate('/');
    else if (view === 'profile') navigate('/profile');
    else if (view === 'planning') navigate('/planning');
    else if (view === 'scraper') navigate('/scraper-admin');
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
  }, []);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return allEvents.find(e => e.id === selectedEventId) || null;
  }, [selectedEventId, allEvents]);

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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="pb-32"
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border pt-safe">
          {/* Location row */}
          <div className="px-6 py-3 flex items-center justify-between">
            <button 
              onClick={handleLocationClick}
              className="flex items-center gap-2 hover:bg-muted rounded-xl py-2 px-3 -ml-3 min-h-[44px] transition-all active:scale-[0.98]"
            >
              {permissionState === 'granted' && locationPrefs.useGPS ? (
                <Navigation size={18} className="text-primary" />
              ) : (
                <MapPin size={18} className="text-primary" />
              )}
              <span className="text-[15px] font-semibold text-foreground">
                {locationText}
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="px-6 pb-4">
            <GlassSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onFocus={handleSearchFocus}
              onCancel={handleSearchCancel}
              mode={mode}
              placeholder="Search events, venues, categories..."
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
                className="space-y-12 py-6"
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
                  <>
                    {/* Featured Hero */}
                    {featuredEvent && (
                      <div className="px-6">
                        <FeaturedEventHero
                          event={featuredEvent}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          isJoining={isJoining(featuredEvent.id)}
                          hasJoined={hasJoinedFeatured}
                        />
                      </div>
                    )}

                    {/* Friends Pulse Rail */}
                    <div className="px-6">
                      <FriendsPulseRail
                        currentUserProfileId={profile?.id}
                        onEventClick={handleEventClick}
                      />
                    </div>

                    {/* Popular in [City] Rail */}
                    {popularEvents.length > 0 && (
                      <DiscoveryRail title={`🔥 Popular in ${locationText}`}>
                        <HorizontalEventCarousel
                          title=""
                          events={popularEvents}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                          currentUserProfileId={profile?.id}
                        />
                      </DiscoveryRail>
                    )}

                    {/* Plan Your Weekend Rail */}
                    {weekendEvents.length > 0 && (
                      <DiscoveryRail title="📅 Plan Your Weekend">
                        <HorizontalEventCarousel
                          title=""
                          events={weekendEvents}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                          currentUserProfileId={profile?.id}
                        />
                      </DiscoveryRail>
                    )}

                    {/* Tonight Rail */}
                    {tonightEvents.length > 0 && (
                      <DiscoveryRail title="⚡ Tonight">
                        <HorizontalEventCarousel
                          title=""
                          events={tonightEvents}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                          currentUserProfileId={profile?.id}
                        />
                      </DiscoveryRail>
                    )}

                    {/* Live Music Rail */}
                    {musicEvents.length > 0 && (
                      <DiscoveryRail title="🎵 Live Music">
                        <HorizontalEventCarousel
                          title=""
                          events={musicEvents}
                          onEventClick={handleEventClick}
                          onJoinEvent={handleJoinEvent}
                          joiningEventId={allEvents.find(e => isJoining(e.id))?.id}
                          currentUserProfileId={profile?.id}
                        />
                      </DiscoveryRail>
                    )}
                  </>
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

      {/* Floating Action Button */}
      <motion.button
        onClick={async () => {
          await hapticImpact('medium');
          setShowCreateModal(true);
        }}
        className="fixed bottom-24 right-5 z-40 w-16 h-16 min-h-[52px] min-w-[52px] rounded-[1.5rem] bg-primary text-primary-foreground flex items-center justify-center mb-safe border-[0.5px] border-primary/20"
        style={{
          boxShadow: '0 8px 24px -4px rgba(var(--primary) / 0.3), 0 16px 40px -8px rgba(0, 0, 0, 0.15)'
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>

      <FloatingNav activeView="feed" onNavigate={handleNavigate} />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <ErrorBoundary>
          <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
            <EventDetailModal
              event={selectedEvent}
              onClose={handleCloseEventDetail}
              onJoin={() => handleJoinEvent()}
              isJoining={isJoining(selectedEventId || '')}
              currentUserProfileId={profile?.id}
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
              defaultEventType="anchor"
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Discovery;
