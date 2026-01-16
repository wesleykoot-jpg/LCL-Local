import React from 'react';
import { useUnifiedItinerary } from './hooks/useUnifiedItinerary';
import { ItineraryTimeline } from './components/ItineraryTimeline';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Compass, RefreshCw, Calendar, Map } from 'lucide-react';
import { FloatingNav } from '@/shared/components/FloatingNav';

/**
 * My Planning Page - TripAdvisor-style smart itinerary view
 * 
 * Displays a unified timeline of:
 * - LCL events the user has joined
 * - Google Calendar events (if connected)
 * 
 * Features:
 * - Glassmorphism sticky header
 * - Vertical rail timeline with date grouping
 * - Empty state with journey prompt
 */
const MyPlanning = () => {
  const { groupedTimeline, timelineItems, isLoading, isEmpty, refresh } = useUnifiedItinerary();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Sticky Glassmorphism Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">My Planning</h1>
        </header>
        <div className="pt-4 px-4">
          <LoadingSkeleton />
        </div>
        <FloatingNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Glassmorphism Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Map className="w-6 h-6 text-primary" />
              My Planning
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isEmpty 
                ? 'Your upcoming journey awaits' 
                : `${timelineItems.length} event${timelineItems.length === 1 ? '' : 's'} planned`
              }
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh} 
            className="text-muted-foreground hover:text-foreground"
            aria-label="Refresh planning"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content Area */}
      {isEmpty ? (
        /* Empty State - Start your Journey */
        <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Calendar className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">Start Your Journey</h3>
            <p className="text-muted-foreground mt-2 text-sm max-w-xs">
              Explore events near you and join one to build your personal itinerary.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/feed')} 
            className="rounded-full px-6"
            size="lg"
          >
            <Compass className="w-4 h-4 mr-2" />
            Explore Events
          </Button>
        </div>
      ) : (
        /* TripAdvisor Timeline */
        <ItineraryTimeline groupedItems={groupedTimeline} />
      )}

      {/* Bottom Navigation */}
      <FloatingNav />
    </div>
  );
};

export default MyPlanning;
