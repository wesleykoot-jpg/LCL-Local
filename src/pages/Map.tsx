import { Suspense, lazy } from 'react';
import { FloatingNav } from '@/components/FloatingNav';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const MapView = lazy(() => import('@/components/MapView').then(m => ({ default: m.MapView })));

const Map = () => {
  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSkeleton />}>
          <MapView />
        </Suspense>
      </ErrorBoundary>
      <FloatingNav activeView="map" />
    </>
  );
};

export default Map;
