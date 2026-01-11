import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/components/FloatingNav';
import { DebugConnection } from '@/components/DebugConnection';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const MapView = lazy(() => import('@/components/MapView').then(m => ({ default: m.MapView })));

const Map = () => {
  const navigate = useNavigate();

  const handleNavigate = (view: 'feed' | 'map' | 'profile') => {
    if (view === 'feed') navigate('/feed');
    else if (view === 'map') navigate('/map');
    else if (view === 'profile') navigate('/profile');
  };

  return (
    <>
      <DebugConnection />
      <ErrorBoundary>
        <Suspense fallback={<LoadingSkeleton />}>
          <MapView />
        </Suspense>
      </ErrorBoundary>
      <FloatingNav activeView="map" onNavigate={handleNavigate} />
    </>
  );
};

export default Map;
