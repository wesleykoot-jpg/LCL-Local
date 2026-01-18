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
 * Updated to LCL Design System v5.0 "Social Air"
 * 
 * Displays a unified timeline of:
 * - LCL events the user has joined
 * - Google Calendar events (if connected)
 * 
 * Features:
 * - Solid card surface sticky header with Air shadow system
 * - Vertical rail timeline with date grouping
 * - Empty state with journey prompt
 * - Social Indigo (#6366F1) primary action color
 * - Consistent design tokens matching Discovery page
 */
const MyPlanning = () => {
  const { groupedTimeline, timelineItems, isLoading, isEmpty, refresh } = useUnifiedItinerary();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Sticky Solid Header - LCL Core 2026 */}
        <header className="sticky top-0 z-30 bg-card border-b border-border shadow-card px-6 py-4">
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
      {/* Sticky Solid Header - LCL Core 2026 */}
      <header className="sticky top-0 z-30 bg-card border-b border-border shadow-card">
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
            className="text-muted-foreground hover:text-foreground min-h-touch min-w-touch"
            aria-label="Refresh planning"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content Area */}
      {isEmpty ? (
        /* Empty State - Start your Journey - LCL Core 2026 */
        <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center shadow-card">
            <Calendar className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">Start Your Journey</h3>
            <p className="text-muted-foreground mt-2 text-sm max-w-xs">
              Explore events near you and join one to build your personal itinerary.
            </p>
          </div>
          <button 
            onClick={() => navigate('/feed')} 
            className="h-touch bg-primary text-primary-foreground font-bold rounded-2xl shadow-card active:opacity-90 transition-all px-6 flex items-center gap-2"
          >
            <Compass className="w-4 h-4" />
            Explore Events
          </button>
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
