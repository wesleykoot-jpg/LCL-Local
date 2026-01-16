import { describe, expect, it } from 'vitest';
import {
  predictPersona,
  shouldSuggestPersonaChange,
  getPersonaDisplayInfo,
  type PredictorContext,
} from '../personaPredictor';

describe('personaPredictor', () => {
  describe('predictPersona', () => {
    it('predicts Professional during work hours on weekdays', () => {
      // Wednesday at 10:00 AM
      const context: PredictorContext = {
        currentTime: new Date(2026, 0, 14, 10, 0, 0), // Wednesday Jan 14, 2026
      };
      
      const result = predictPersona(context);
      
      expect(result.persona).toBe('professional');
      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.reason).toContain('work hours');
    });

    it('predicts Family on weekend mornings', () => {
      // Saturday at 9:00 AM
      const context: PredictorContext = {
        currentTime: new Date(2026, 0, 17, 9, 0, 0), // Saturday Jan 17, 2026
      };
      
      const result = predictPersona(context);
      
      expect(result.persona).toBe('family');
      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.reason).toContain('family');
    });

    it('predicts Social on weekday evenings', () => {
      // Thursday at 7:00 PM
      const context: PredictorContext = {
        currentTime: new Date(2026, 0, 15, 19, 0, 0), // Thursday Jan 15, 2026
      };
      
      const result = predictPersona(context);
      
      expect(result.persona).toBe('social');
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });

    it('predicts Social on weekend afternoons', () => {
      // Saturday at 4:00 PM
      const context: PredictorContext = {
        currentTime: new Date(2026, 0, 17, 16, 0, 0), // Saturday Jan 17, 2026
      };
      
      const result = predictPersona(context);
      
      expect(result.persona).toBe('social');
    });

    it('predicts Professional when near office with high confidence', () => {
      const context: PredictorContext = {
        currentTime: new Date(2026, 0, 14, 14, 0, 0),
        userLocation: { lat: 52.3676, lng: 4.9041 },
        officeCoordinates: { lat: 52.3680, lng: 4.9045 }, // ~50m away
      };
      
      const result = predictPersona(context);
      
      expect(result.persona).toBe('professional');
      expect(result.confidence).toBe(90); // HIGH confidence for office proximity
      expect(result.reason).toContain('office');
    });

    it('returns timestamp in prediction', () => {
      const now = new Date();
      const context: PredictorContext = {
        currentTime: now,
      };
      
      const result = predictPersona(context);
      
      expect(result.timestamp).toBe(now.getTime());
    });
  });

  describe('shouldSuggestPersonaChange', () => {
    it('returns true when prediction differs with high confidence', () => {
      const prediction = {
        persona: 'social' as const,
        confidence: 85,
        reason: 'Evening vibes',
        timestamp: Date.now(),
      };
      
      const result = shouldSuggestPersonaChange(prediction, 'professional', 80);
      
      expect(result).toBe(true);
    });

    it('returns false when prediction matches current persona', () => {
      const prediction = {
        persona: 'social' as const,
        confidence: 90,
        reason: 'Evening vibes',
        timestamp: Date.now(),
      };
      
      const result = shouldSuggestPersonaChange(prediction, 'social', 80);
      
      expect(result).toBe(false);
    });

    it('returns false when confidence is below threshold', () => {
      const prediction = {
        persona: 'social' as const,
        confidence: 70,
        reason: 'General leisure',
        timestamp: Date.now(),
      };
      
      const result = shouldSuggestPersonaChange(prediction, 'professional', 80);
      
      expect(result).toBe(false);
    });

    it('returns false when current persona is null', () => {
      const prediction = {
        persona: 'social' as const,
        confidence: 90,
        reason: 'Evening vibes',
        timestamp: Date.now(),
      };
      
      const result = shouldSuggestPersonaChange(prediction, null, 80);
      
      expect(result).toBe(false);
    });
  });

  describe('getPersonaDisplayInfo', () => {
    it('returns correct info for professional persona', () => {
      const info = getPersonaDisplayInfo('professional');
      
      expect(info.label).toBe('Professional');
      expect(info.emoji).toBe('💼');
      expect(info.description).toBeTruthy();
    });

    it('returns correct info for family persona', () => {
      const info = getPersonaDisplayInfo('family');
      
      expect(info.label).toBe('Family');
      expect(info.emoji).toBe('👨‍👩‍👧‍👦');
      expect(info.description.toLowerCase()).toContain('kid-friendly');
    });

    it('returns correct info for social persona', () => {
      const info = getPersonaDisplayInfo('social');
      
      expect(info.label).toBe('Social');
      expect(info.emoji).toBe('🎉');
      expect(info.description).toContain('social');
    });
  });
});
