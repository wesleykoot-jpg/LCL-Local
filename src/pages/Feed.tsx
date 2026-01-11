import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { EventCard } from '@/components/EventCard';
import { FloatingNav } from '@/components/FloatingNav';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/useAuth';
import { MapPin, SlidersHorizontal, Plus } from 'lucide-react';
import { useEvents, useJoinEvent } from '@/lib/hooks';
import { formatEventTime } from '@/lib/utils';
import { CATEGORY_MAP } from '@/lib/categories';

const CreateEventModal = lazy(() => import('@/components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));

const Feed = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { events: allEvents, loading, refetch: refetchEvents } = useEvents();
  const { handleJoinEvent, joiningEvents } = useJoinEvent(profile?.id, refetchEvents);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  const {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    isLoaded,
  } = useOnboarding();

  // Filter events based on user preferences
  const filteredEvents = useMemo(() => {
    if (!preferences?.selectedCategories?.length) return allEvents;
    
    return allEvents.filter(event => {
      const mappedCategory = CATEGORY_MAP[event.category] || event.category;
      return preferences.selectedCategories.includes(mappedCategory);
    });
  }, [allEvents, preferences?.selectedCategories]);

  const handleNavigate = (view: 'feed' | 'map' | 'profile') => {
    if (view === 'feed') navigate('/feed');
    else if (view === 'map') navigate('/map');
    else if (view === 'profile') navigate('/profile');
  };

  // Show loading while checking onboarding status
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-32 font-sans selection:bg-white selection:text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-40 px-5 py-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div>
          <h1 className="text-xl font-bold text-white leading-tight tracking-tight">
            Discover
          </h1>
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mt-0.5">
            <MapPin size={12} />
            <span>{preferences?.zone || profile?.location_city || 'Amsterdam'}</span>
          </div>
        </div>
        
        <button 
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <SlidersHorizontal size={18} />
        </button>
      </header>

      {/* Filter Menu Dropdown */}
      <AnimatePresence>
        {showFilterMenu && (
          <div className="absolute top-16 right-4 z-50 bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[200px]">
            <p className="text-xs text-zinc-500 mb-3 font-medium">Active Filters</p>
            {preferences?.selectedCategories?.length ? (
              <div className="flex flex-wrap gap-2">
                {preferences.selectedCategories.slice(0, 4).map(cat => (
                  <span key={cat} className="px-2.5 py-1 bg-white/10 rounded-lg text-xs text-white capitalize">
                    {cat}
                  </span>
                ))}
                {preferences.selectedCategories.length > 4 && (
                  <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs text-zinc-400">
                    +{preferences.selectedCategories.length - 4}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">All categories</p>
            )}
            <button
              onClick={() => {
                setShowOnboarding(true);
                setShowFilterMenu(false);
              }}
              className="mt-4 w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium text-white transition-colors"
            >
              Edit Preferences
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="px-4 max-w-lg mx-auto pt-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="space-y-4">
            {filteredEvents.map(event => (
              <EventCard
                key={event.id}
                id={event.id}
                title={event.title}
                category={event.category}
                venue={event.venue_name}
                date={formatEventTime(event.event_date, event.event_time)}
                imageUrl={event.image_url || undefined}
                matchPercentage={event.match_percentage || undefined}
                attendees={[
                  { id: '1', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&auto=format&fit=crop&q=60', alt: 'User 1' },
                  { id: '2', image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60', alt: 'User 2' },
                ]}
                extraCount={event.attendee_count ? Math.max(0, event.attendee_count - 2) : 0}
                onJoin={handleJoinEvent}
                isJoining={joiningEvents.has(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <MapPin size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No events found</h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              Try adjusting your filters or check back later for new events.
            </p>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full bg-white text-zinc-900 shadow-soft-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

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
