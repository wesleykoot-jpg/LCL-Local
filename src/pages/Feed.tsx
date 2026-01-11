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
import { MapPin, Plus, Settings } from 'lucide-react';
import { useEvents } from '@/lib/hooks';

const CreateEventModal = lazy(() => import('@/components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));

const Feed = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { events: allEvents, loading } = useEvents();
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    isLoaded,
  } = useOnboarding();

  const handleNavigate = (view: 'feed' | 'map' | 'profile') => {
    if (view === 'feed') navigate('/feed');
    else if (view === 'map') navigate('/map');
    else if (view === 'profile') navigate('/profile');
  };

  const handleEventClick = (eventId: string) => {
    // TODO: Open event detail modal/page
    console.log('Event clicked:', eventId);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 font-sans selection:bg-primary selection:text-primary-foreground">
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
      <main className="px-4 pt-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <motion.div
                key={i}
                className="aspect-[4/3] bg-muted rounded-2xl"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
              />
            ))}
          </div>
        ) : (
          <EventFeed
            events={allEvents}
            onEventClick={handleEventClick}
          />
        )}
      </main>

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
