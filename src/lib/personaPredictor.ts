/**
 * Persona Predictor
 * 
 * AI-powered persona prediction engine for IO26 Standards.
 * Uses time-based and location-based heuristics to predict user persona.
 * 
 * Personas:
 * - Professional: Mon-Fri (09:00-17:00) OR proximity < 500m to OFFICE_COORDINATES
 * - Family: Sat-Sun mornings (< 14:00)
 * - Social: Default for evenings/nights and weekend afternoons
 */

import { calculateDistanceKm } from '@/lib/distance';

export type PersonaType = 'professional' | 'family' | 'social';

export interface PersonaPrediction {
  /** Predicted persona type */
  persona: PersonaType;
  /** Confidence score (0-100) */
  confidence: number;
  /** Explanation for the prediction */
  reason: string;
  /** Timestamp of the prediction */
  timestamp: number;
}

export interface PredictorContext {
  /** Current timestamp (for testability) */
  currentTime?: Date;
  /** User's current location */
  userLocation?: { lat: number; lng: number } | null;
  /** User's office coordinates (if known) */
  officeCoordinates?: { lat: number; lng: number } | null;
  /** User's explicitly set persona (if any) */
  currentPersona?: PersonaType | null;
}

// Constants for persona prediction
const OFFICE_PROXIMITY_THRESHOLD_KM = 0.5; // 500m
const CONFIDENCE_THRESHOLDS = {
  HIGH: 90,
  MEDIUM: 70,
  LOW: 50,
};

/**
 * Check if given time falls within work hours (Mon-Fri 09:00-17:00)
 */
function isWorkHours(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = date.getHours();
  
  // Weekday (Monday = 1 to Friday = 5)
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  // Work hours (9 AM to 5 PM)
  const isDuringWorkHours = hour >= 9 && hour < 17;
  
  return isWeekday && isDuringWorkHours;
}

/**
 * Check if given time is a weekend morning (Sat-Sun before 14:00)
 */
function isWeekendMorning(date: Date): boolean {
  const dayOfWeek = date.getDay();
  const hour = date.getHours();
  
  // Weekend (Saturday = 6 or Sunday = 0)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  // Morning/early afternoon (before 2 PM)
  const isMorning = hour < 14;
  
  return isWeekend && isMorning;
}

/**
 * Check if given time is evening/night (after 17:00)
 */
function isEvening(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 17 || hour < 6; // After 5 PM or before 6 AM
}

/**
 * Check if user is near their office location
 */
function isNearOffice(
  userLocation: { lat: number; lng: number } | null | undefined,
  officeCoordinates: { lat: number; lng: number } | null | undefined
): boolean {
  if (!userLocation || !officeCoordinates) return false;
  
  const distance = calculateDistanceKm(
    userLocation.lat,
    userLocation.lng,
    officeCoordinates.lat,
    officeCoordinates.lng
  );
  
  return distance <= OFFICE_PROXIMITY_THRESHOLD_KM;
}

/**
 * Predict the user's persona based on context
 */
export function predictPersona(context: PredictorContext = {}): PersonaPrediction {
  const now = context.currentTime || new Date();
  const { userLocation, officeCoordinates } = context;
  
  // Check if near office (highest priority for Professional)
  if (isNearOffice(userLocation, officeCoordinates)) {
    return {
      persona: 'professional',
      confidence: CONFIDENCE_THRESHOLDS.HIGH,
      reason: 'You appear to be near your office',
      timestamp: now.getTime(),
    };
  }
  
  // Check time-based patterns
  if (isWorkHours(now)) {
    return {
      persona: 'professional',
      confidence: CONFIDENCE_THRESHOLDS.MEDIUM,
      reason: 'It\'s work hours on a weekday',
      timestamp: now.getTime(),
    };
  }
  
  if (isWeekendMorning(now)) {
    return {
      persona: 'family',
      confidence: CONFIDENCE_THRESHOLDS.MEDIUM,
      reason: 'Weekend mornings are family time',
      timestamp: now.getTime(),
    };
  }
  
  if (isEvening(now)) {
    return {
      persona: 'social',
      confidence: CONFIDENCE_THRESHOLDS.MEDIUM,
      reason: 'Evening is perfect for social activities',
      timestamp: now.getTime(),
    };
  }
  
  // Weekend afternoons default to social
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  if (isWeekend) {
    return {
      persona: 'social',
      confidence: CONFIDENCE_THRESHOLDS.LOW,
      reason: 'Weekend afternoon vibes',
      timestamp: now.getTime(),
    };
  }
  
  // Default fallback to social
  return {
    persona: 'social',
    confidence: CONFIDENCE_THRESHOLDS.LOW,
    reason: 'General leisure time',
    timestamp: now.getTime(),
  };
}

/**
 * Check if we should suggest a persona change
 * Returns true if predicted persona differs from current with high confidence
 */
export function shouldSuggestPersonaChange(
  prediction: PersonaPrediction,
  currentPersona: PersonaType | null | undefined,
  confidenceThreshold: number = 80
): boolean {
  if (!currentPersona) return false;
  
  return (
    prediction.persona !== currentPersona &&
    prediction.confidence >= confidenceThreshold
  );
}

/**
 * Get persona display information
 */
export function getPersonaDisplayInfo(persona: PersonaType): {
  label: string;
  emoji: string;
  description: string;
} {
  const personaInfo: Record<PersonaType, { label: string; emoji: string; description: string }> = {
    professional: {
      label: 'Professional',
      emoji: '💼',
      description: 'Networking events, business meetups',
    },
    family: {
      label: 'Family',
      emoji: '👨‍👩‍👧‍👦',
      description: 'Kid-friendly activities, family outings',
    },
    social: {
      label: 'Social',
      emoji: '🎉',
      description: 'Casual hangouts, social events',
    },
  };
  
  return personaInfo[persona];
}
