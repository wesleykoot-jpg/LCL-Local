/**
 * usePersonaAI Hook
 * 
 * Bridges LocationContext and FeedContext with the Persona Predictor.
 * Provides real-time persona predictions based on user context.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from '@/features/location';
import { useFeedMode, type FeedMode } from '@/contexts/FeedContext';
import {
  predictPersona,
  shouldSuggestPersonaChange,
  getPersonaDisplayInfo,
  type PersonaType,
  type PersonaPrediction,
} from '@/lib/personaPredictor';

// Prediction interval (check every 5 minutes)
const PREDICTION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Map FeedMode to PersonaType
 * 
 * FeedMode is the app's feed filter state, while PersonaType is the AI prediction.
 * 'default' mode doesn't correspond to a specific persona - it's the neutral state.
 */
function feedModeToPersona(mode: FeedMode): PersonaType | null {
  const mapping: Record<FeedMode, PersonaType | null> = {
    family: 'family',
    social: 'social',
    default: null, // 'default' doesn't map to a specific persona
  };
  return mapping[mode];
}

/**
 * Map PersonaType to FeedMode
 * 
 * Core business logic decision:
 * - 'professional' persona maps to 'default' feed mode because:
 *   1. Business events are shown in the default feed alongside other events
 *   2. Professional networking events are not siloed into their own category
 *   3. The 'default' mode represents a general-purpose feed suitable for work contexts
 * - 'family' and 'social' have direct 1:1 mappings to their feed modes
 */
function personaToFeedMode(persona: PersonaType): FeedMode {
  const mapping: Record<PersonaType, FeedMode> = {
    professional: 'default',
    family: 'family',
    social: 'social',
  };
  return mapping[persona];
}

export interface UsePersonaAIOptions {
  /** User's office coordinates (if known) */
  officeCoordinates?: { lat: number; lng: number } | null;
  /** Confidence threshold for suggestions (default: 80) */
  confidenceThreshold?: number;
  /** Whether to enable auto-prediction (default: true) */
  enabled?: boolean;
}

export interface UsePersonaAIResult {
  /** Current prediction */
  prediction: PersonaPrediction | null;
  /** Whether a persona change should be suggested */
  shouldSuggest: boolean;
  /** Display info for the suggested persona */
  suggestedPersonaInfo: ReturnType<typeof getPersonaDisplayInfo> | null;
  /** Last prediction timestamp */
  lastPredictionTime: number | null;
  /** Accept the suggested persona */
  acceptSuggestion: () => void;
  /** Dismiss the suggestion */
  dismissSuggestion: () => void;
  /** Force a new prediction */
  refreshPrediction: () => void;
}

export function usePersonaAI(options: UsePersonaAIOptions = {}): UsePersonaAIResult {
  const {
    officeCoordinates = null,
    confidenceThreshold = 80,
    enabled = true,
  } = options;

  const { location } = useLocation();
  const { feedMode, setFeedMode } = useFeedMode();

  const [prediction, setPrediction] = useState<PersonaPrediction | null>(null);
  const [lastPredictionTime, setLastPredictionTime] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  /**
   * Run persona prediction
   */
  const runPrediction = useCallback(() => {
    const result = predictPersona({
      currentTime: new Date(),
      userLocation: location,
      officeCoordinates,
      currentPersona: feedModeToPersona(feedMode),
    });

    setPrediction(result);
    setLastPredictionTime(result.timestamp);
    setIsDismissed(false);
  }, [location, officeCoordinates, feedMode]);

  /**
   * Check if we should suggest a persona change
   */
  const shouldSuggest = useMemo(() => {
    if (!prediction || isDismissed || !enabled) return false;

    const currentPersona = feedModeToPersona(feedMode);
    return shouldSuggestPersonaChange(prediction, currentPersona, confidenceThreshold);
  }, [prediction, feedMode, confidenceThreshold, isDismissed, enabled]);

  /**
   * Get display info for the suggested persona
   */
  const suggestedPersonaInfo = useMemo(() => {
    if (!shouldSuggest || !prediction) return null;
    return getPersonaDisplayInfo(prediction.persona);
  }, [shouldSuggest, prediction]);

  /**
   * Accept the suggested persona
   */
  const acceptSuggestion = useCallback(() => {
    if (prediction) {
      const newMode = personaToFeedMode(prediction.persona);
      setFeedMode(newMode);
      setIsDismissed(true);
    }
  }, [prediction, setFeedMode]);

  /**
   * Dismiss the suggestion
   */
  const dismissSuggestion = useCallback(() => {
    setIsDismissed(true);
  }, []);

  /**
   * Force a new prediction
   */
  const refreshPrediction = useCallback(() => {
    runPrediction();
  }, [runPrediction]);

  // Run initial prediction and set up interval
  useEffect(() => {
    if (!enabled) return;

    // Run initial prediction
    runPrediction();

    // Set up periodic prediction
    const intervalId = setInterval(runPrediction, PREDICTION_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, runPrediction]);

  return {
    prediction,
    shouldSuggest,
    suggestedPersonaInfo,
    lastPredictionTime,
    acceptSuggestion,
    dismissSuggestion,
    refreshPrediction,
  };
}

export default usePersonaAI;
