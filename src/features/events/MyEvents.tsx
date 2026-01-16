import React from 'react';
import { useUnifiedItinerary } from './hooks/useUnifiedItinerary';
import { ItineraryTimeline } from './components/ItineraryTimeline';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Compass, RefreshCw, Calendar } from 'lucide-react';

const MyEvents = () => {
  const { groupedTimeline, timelineItems, isLoading, isEmpty, refresh } = useUnifiedItinerary();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="pt-24 px-4 min-h-screen bg-background">
        <h1 className="text-3xl font-bold text-foreground mb-6">My Plan</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="px-6 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Plan</h1>
          <p className="text-muted-foreground text-sm">
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
        >
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border border-border">
            <Calendar className="w-10 h-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">No plans yet</h3>
            <p className="text-muted-foreground mt-2 text-sm max-w-xs">
              Explore events near you and join one to add it to your plan.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/')} 
            className="rounded-full"
          >
            <Compass className="w-4 h-4 mr-2" />
            Explore Events
          </Button>
        </div>
      ) : (
        <ItineraryTimeline groupedItems={groupedTimeline} />
      )}
    </div>
  );
};

export default MyEvents;
