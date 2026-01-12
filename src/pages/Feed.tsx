import { useState, lazy, Suspense, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { EventFeed } from '@/components/EventFeed';
import { FloatingNav } from '@/components/FloatingNav';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/useAuth';
import { MapPin, Plus, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useEvents, useJoinEvent } from '@/lib/hooks';
import { motion } from 'framer-motion';

const CreateEventModal = lazy(() => import('@/components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));
const EventDetailModal = lazy(() => import('@/components/EventDetailModal'));

// Mock events for looking up event details
const MOCK_MEPPEL_EVENTS = [
  {
    id: 'mock-1',
    title: 'FC Meppel thuiswedstrijd op Ezinge',
    category: 'active',
    venue_name: 'Sportpark Ezinge, Meppel',
    event_date: '2025-04-12',
    event_time: '14:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=900&q=80',
    match_percentage: 92,
    attendee_count: 24,
    description: 'Come watch FC Meppel play at home! Great atmosphere and good food at the canteen.',
  },
  {
    id: 'mock-2',
    title: 'Spellenavond bij Café De Kansel',
    category: 'gaming',
    venue_name: 'Café De Kansel, Woldstraat',
    event_date: '2025-03-28',
    event_time: '19:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80',
    match_percentage: 85,
    attendee_count: 16,
    description: 'Weekly board game night with a great selection of games. All skill levels welcome!',
  },
  {
    id: 'mock-3',
    title: 'Speelmiddag in Wilhelminapark',
    category: 'family',
    venue_name: 'Wilhelminapark Meppel',
    event_date: '2025-05-10',
    event_time: '10:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
    match_percentage: 78,
    attendee_count: 8,
    description: 'Fun afternoon for families with kids. Bring your own toys and snacks!',
  },
  {
    id: 'mock-4',
    title: 'Vrijmibo bij Café 1761',
    category: 'social',
    venue_name: 'Café 1761, Prinsengracht',
    event_date: '2025-03-21',
    event_time: '17:00',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
    match_percentage: 88,
    attendee_count: 18,
    description: 'Weekly Friday afternoon drinks. Great way to end the work week!',
  },
];

const Feed = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { events: allEvents, loading, refetch } = useEvents({ currentUserProfileId: profile?.id });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  // Use real Supabase join event hook
  const { handleJoinEvent: joinEvent, isJoining } = useJoinEvent(profile?.id, refetch);
  
  const {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    isLoaded,
  } = useOnboarding();

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

  // Find selected event from all sources
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    
    // Check real events first
    const realEvent = allEvents.find(e => e.id === selectedEventId);
    if (realEvent) return realEvent;
    
    // Check mock events
    const mockEvent = MOCK_MEPPEL_EVENTS.find(e => e.id === selectedEventId);
    if (mockEvent) {
      return {
        ...mockEvent,
        created_at: null,
        created_by: null,
        location: null,
        max_attendees: null,
        parent_event_id: null,
        status: 'active',
        updated_at: null,
      };
    }
    
    return null;
  }, [selectedEventId, allEvents]);

  // Handle joining event from detail modal using real Supabase API
  const handleJoinEvent = useCallback(async () => {
    if (!selectedEventId) return;
    await joinEvent(selectedEventId);
    // Optionally close modal after successful join
    setSelectedEventId(null);
  }, [selectedEventId, joinEvent]);

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
        className="pb-40"
      >
        {/* Header - Location-first, Airbnb-inspired */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="px-5 py-4 flex items-center justify-between">
            {/* Location as primary element */}
            <button className="flex items-center gap-2 hover:bg-muted/50 rounded-full py-1.5 px-3 -ml-3 transition-colors">
              <MapPin size={18} className="text-primary" />
              <span className="font-display text-lg text-foreground">
                {preferences?.zone || profile?.location_city || 'Meppel, NL'}
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
            
            {/* Filter button */}
            <button 
              onClick={() => setShowOnboarding(true)}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors shadow-sm"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </header>

        {/* Main Content - Warm, organized feed */}
        <main className="px-4 pt-4 overflow-x-hidden">
          {loading ? (
            <div className="max-w-md mx-auto flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="h-64 bg-muted/50 rounded-2xl"
                  animate={{ opacity: [0.4, 0.6, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.15 }}
                />
              ))}
            </div>
          ) : (
            <EventFeed
              events={allEvents}
              onEventClick={handleEventClick}
              userPreferences={preferences}
              showVibeHeaders
              profileId={profile?.id}
              onEventsChange={refetch}
            />
          )}
        </main>
      </motion.div>

      {/* Floating Action Button */}
      <motion.button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full btn-action flex items-center justify-center shadow-lg"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </motion.button>

      <FloatingNav activeView="feed" onNavigate={handleNavigate} />

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
              onJoin={handleJoinEvent}
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
