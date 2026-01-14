import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type FeedMode = 'family' | 'social' | 'default';

interface FeedContextValue {
  feedMode: FeedMode;
  setFeedMode: (mode: FeedMode) => void;
  isParentDetected: boolean;
  setIsParentDetected: (detected: boolean) => void;
}

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

const FEED_MODE_STORAGE_KEY = 'lcl_feed_mode';
const PARENT_DETECTED_STORAGE_KEY = 'lcl_parent_detected';

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feedMode, setFeedModeState] = useState<FeedMode>(() => {
    const stored = localStorage.getItem(FEED_MODE_STORAGE_KEY);
    return (stored as FeedMode) || 'default';
  });

  const [isParentDetected, setIsParentDetectedState] = useState<boolean>(() => {
    const stored = localStorage.getItem(PARENT_DETECTED_STORAGE_KEY);
    return stored === 'true';
  });

  const setFeedMode = (mode: FeedMode) => {
    setFeedModeState(mode);
    localStorage.setItem(FEED_MODE_STORAGE_KEY, mode);
  };

  const setIsParentDetected = (detected: boolean) => {
    setIsParentDetectedState(detected);
    localStorage.setItem(PARENT_DETECTED_STORAGE_KEY, detected.toString());
  };

  return (
    <FeedContext.Provider
      value={{
        feedMode,
        setFeedMode,
        isParentDetected,
        setIsParentDetected,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
}

export function useFeedMode() {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error('useFeedMode must be used within a FeedProvider');
  }
  return context;
}
