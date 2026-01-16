import React from 'react';
import { useUnifiedItinerary } from './hooks/useUnifiedItinerary';
import { ItineraryTimeline } from './components/ItineraryTimeline';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Compass, RefreshCw } from 'lucide-react';

const MyEvents = () => {
  const { groupedTimeline, isLoading, isEmpty, refresh } = useUnifiedItinerary();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="pt-24 px-4 h-screen bg-black">
        <h1 className="text-3xl font-bold text-white mb-6">My Plan</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="px-6 mb-2 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">My Plan</h1>
          <p className="text-white/40 text-sm">Your upcoming journey</p>
        </div>
        <Button variant="ghost" size="icon" onClick={refresh} className="text-white/50">
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Compass className="w-10 h-10 text-white/40" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">No plans yet</h3>
            <p className="text-white/50 mt-2 text-sm">Join a Fork to start your journey.</p>
          </div>
          <Button onClick={() => navigate('/')} className="bg-white text-black rounded-full">
            Explore Feed
          </Button>
        </div>
      ) : (
        <ItineraryTimeline groupedItems={groupedTimeline} />
      )}
    </div>
  );
};

export default MyEvents;
