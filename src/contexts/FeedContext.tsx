import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PersonaType, PersonaPrediction } from '@/lib/personaPredictor';

export type FeedMode = 'family' | 'social' | 'default';

interface FeedContextValue {
  feedMode: FeedMode;
  setFeedMode: (mode: FeedMode) => void;
  isParentDetected: boolean;
  setIsParentDetected: (detected: boolean) => void;
  /** IO26: AI-suggested persona from the prediction engine */
  suggestedPersona: PersonaType | null;
  setSuggestedPersona: (persona: PersonaType | null) => void;
  /** IO26: Timestamp of the last persona prediction */
  lastPredictionTime: number | null;
  setLastPredictionTime: (time: number | null) => void;
  /** IO26: Full prediction object for advanced usage */
  currentPrediction: PersonaPrediction | null;
  setCurrentPrediction: (prediction: PersonaPrediction | null) => void;
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

  // IO26: Persona prediction state
  const [suggestedPersona, setSuggestedPersona] = useState<PersonaType | null>(null);
  const [lastPredictionTime, setLastPredictionTime] = useState<number | null>(null);
  const [currentPrediction, setCurrentPrediction] = useState<PersonaPrediction | null>(null);

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
        suggestedPersona,
        setSuggestedPersona,
        lastPredictionTime,
        setLastPredictionTime,
        currentPrediction,
        setCurrentPrediction,
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
