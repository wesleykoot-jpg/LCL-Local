import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EventFeed } from '@/components/EventFeed';
import { FloatingNav } from '@/components/FloatingNav';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/useAuth';
import { MapPin, Plus, Settings, Map, List } from 'lucide-react';
import { useEvents } from '@/lib/hooks';

const CreateEventModal = lazy(() => import('@/components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));
const MapView = lazy(() => import('@/components/MapView').then(m => ({ default: m.MapView })));

const Feed = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { events: allEvents, loading } = useEvents();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  const {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    isLoaded,
  } = useOnboarding();

  const handleNavigate = (view: 'feed' | 'map' | 'profile' | 'my-events') => {
    if (view === 'feed') navigate('/feed');
    else if (view === 'map') navigate('/map');
    else if (view === 'profile') navigate('/profile');
    else if (view === 'my-events') navigate('/my-events');
  };

  const handleEventClick = (eventId: string) => {
    // TODO: Open event detail modal/page
    console.log('Event clicked:', eventId);
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'list' ? 'map' : 'list');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pb-40"
          >
            {/* Header - Clean, Airbnb-inspired */}
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <h1 className="font-display text-2xl text-foreground leading-none tracking-tight">
                    Explore
                  </h1>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <MapPin size={14} />
                    <span>{preferences?.zone || profile?.location_city || 'Meppel, NL'}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowOnboarding(true)}
                  className="p-2.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings size={20} />
                </button>
              </div>
            </header>

            {/* Main Content - Instagram/Airbnb style feed */}
            <main className="px-4 pt-6 overflow-x-hidden">
              {loading ? (
                <div className="max-w-md mx-auto flex flex-col gap-5">
                  {[1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      className="h-80 bg-muted rounded-3xl"
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              ) : (
                <EventFeed
                  events={allEvents}
                  onEventClick={handleEventClick}
                  userPreferences={preferences}
                  showVibeHeaders
                />
              )}
            </main>
          </motion.div>
        ) : (
          <motion.div
            key="map-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-screen"
          >
            <Suspense fallback={
              <div className="h-screen bg-muted flex items-center justify-center">
                <LoadingSkeleton />
              </div>
            }>
              <MapView />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Map/List Toggle - Apple Maps style */}
      <motion.button
        onClick={toggleViewMode}
        className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-foreground text-background font-semibold text-sm flex items-center gap-2.5 shadow-2xl"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="map-icon"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Map size={18} />
              <span>Map</span>
            </motion.div>
          ) : (
            <motion.div
              key="list-icon"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-2"
            >
              <List size={18} />
              <span>List</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Floating Action Button - only show in list view */}
      {viewMode === 'list' && (
        <motion.button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full btn-action flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </motion.button>
      )}

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
