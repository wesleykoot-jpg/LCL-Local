import { describe, it, expect } from 'vitest';
import { classifyTextToCategory, INTERNAL_CATEGORIES, type InternalCategory } from '../supabase/functions/_shared/categoryMapping';

/**
 * Test for NL-Context Intelligent Mapping (Updated for Modern Categories)
 * Tests the Hybrid Life logic for Dutch keyword classification
 * 
 * Now uses modern 10-category system:
 * - active, gaming, entertainment, social, family, outdoors, music, workshops, foodie, community
 */

/**
 * mapToInternalCategory implementation matching the updated one in scrape-events
 */
function mapToInternalCategory(input?: string): InternalCategory {
  const value = (input || "").toLowerCase();
  
  // Use the modern category classification system
  const category = classifyTextToCategory(value);
  
  // Validate that the result is one of our internal categories
  if (INTERNAL_CATEGORIES.includes(category as InternalCategory)) {
    return category as InternalCategory;
  }
  
  // Default fallback to community (most general category)
  return "community";
}

describe('Hybrid Life Category Classification (Modern Categories)', () => {
  describe('Dutch Family Keywords (Phase 2)', () => {
    it('should classify basisschool events as family', () => {
      expect(mapToInternalCategory('Basisschool Open Dag')).toBe('family');
      expect(mapToInternalCategory('workshop voor basisschool kinderen')).toBe('family');
    });

    it('should classify speeltuin events as family', () => {
      expect(mapToInternalCategory('Speeltuin Festival')).toBe('family');
      expect(mapToInternalCategory('Nieuwe speeltuin geopend')).toBe('family');
    });

    it('should classify kinderopvang events as family', () => {
      expect(mapToInternalCategory('Kinderopvang Open Huis')).toBe('family');
    });

    it('should classify zwemles events as family', () => {
      expect(mapToInternalCategory('Zwemles voor beginners')).toBe('family');
    });

    it('should classify sinterklaas events as family', () => {
      expect(mapToInternalCategory('Sinterklaas Intocht')).toBe('family');
      expect(mapToInternalCategory('Sinterklaasfeest voor kinderen')).toBe('family');
    });

    it('should classify voorlezen events as family', () => {
      expect(mapToInternalCategory('Voorlezen in de bibliotheek')).toBe('family');
    });

    it('should classify kinderboerderij events as family', () => {
      expect(mapToInternalCategory('Bezoek kinderboerderij')).toBe('family');
    });
  });

  describe('Dutch Adult Social Keywords (Phase 2)', () => {
    it('should classify borrel events as social', () => {
      expect(mapToInternalCategory('Vrijdagmiddag Borrel')).toBe('social');
      expect(mapToInternalCategory('Nieuwjaarsborrel')).toBe('social');
    });

    it('should classify vrijmibo events as social', () => {
      expect(mapToInternalCategory('Vrijmibo bij het stadskantoor')).toBe('social');
    });

    it('should classify netwerken events as social', () => {
      expect(mapToInternalCategory('Netwerken voor ondernemers')).toBe('social');
      expect(mapToInternalCategory('Networking Event Amsterdam')).toBe('social');
    });

    it('should classify wijnproeverij as foodie', () => {
      expect(mapToInternalCategory('Wijnproeverij')).toBe('foodie');
      expect(mapToInternalCategory('Franse wijnproeverij avond')).toBe('foodie');
    });

    it('should classify bierproeverij as foodie', () => {
      expect(mapToInternalCategory('Bierproeverij lokale brouwerij')).toBe('foodie');
    });

    it('should classify proeverij with food context as foodie', () => {
      expect(mapToInternalCategory('Kaas en wijn proeverij')).toBe('foodie');
    });
  });

  describe('Modern Category Classification', () => {
    it('should classify music events as music', () => {
      expect(mapToInternalCategory('Concert')).toBe('music');
      expect(mapToInternalCategory('DJ Night')).toBe('music');
      expect(mapToInternalCategory('Live Music Event')).toBe('music');
    });

    it('should classify food events as foodie', () => {
      expect(mapToInternalCategory('Food Tasting')).toBe('foodie');
      expect(mapToInternalCategory('Restaurant Week')).toBe('foodie');
      expect(mapToInternalCategory('Culinary Event')).toBe('foodie');
    });

    it('should classify entertainment events as entertainment', () => {
      expect(mapToInternalCategory('Theater Show')).toBe('entertainment');
      expect(mapToInternalCategory('Comedy Night')).toBe('entertainment');
      expect(mapToInternalCategory('Film Screening')).toBe('entertainment');
    });

    it('should classify sport events as active', () => {
      expect(mapToInternalCategory('Sport Dag')).toBe('active');
      expect(mapToInternalCategory('Running Event')).toBe('active');
      expect(mapToInternalCategory('Yoga in the park')).toBe('active');
    });

    it('should classify family events as family', () => {
      expect(mapToInternalCategory('Family Day')).toBe('family');
      expect(mapToInternalCategory('Kids Workshop')).toBe('family');
    });

    it('should classify gaming events as gaming', () => {
      expect(mapToInternalCategory('Gaming Tournament')).toBe('gaming');
      expect(mapToInternalCategory('Videogames Event')).toBe('gaming');
      expect(mapToInternalCategory('LAN Party')).toBe('gaming');
    });

    it('should classify workshop events as workshops', () => {
      expect(mapToInternalCategory('Photography Workshop')).toBe('workshops');
      expect(mapToInternalCategory('Cooking Class')).toBe('workshops');
      expect(mapToInternalCategory('Training Session')).toBe('workshops');
    });

    it('should classify outdoor events as outdoors', () => {
      expect(mapToInternalCategory('Nature Walk')).toBe('outdoors');
      expect(mapToInternalCategory('Hiking Excursion')).toBe('outdoors');
      expect(mapToInternalCategory('Outdoor Picnic')).toBe('outdoors');
    });
  });

  describe('Priority of Dutch Keywords', () => {
    it('should prioritize Dutch family keywords over general keywords', () => {
      // Even though "music" is present, basisschool should take priority
      expect(mapToInternalCategory('Basisschool Muziekfestival')).toBe('family');
    });

    it('should prioritize Dutch family keywords over music', () => {
      expect(mapToInternalCategory('Kinderdisco Party Night')).toBe('family');
    });

    it('should prioritize food-related social keywords', () => {
      // Wijnproeverij should be foodie
      expect(mapToInternalCategory('Netwerk borrel met wijnproeverij')).toBe('foodie');
    });
  });

  describe('Fallback to community', () => {
    it('should default to community for unknown events', () => {
      expect(mapToInternalCategory('Random Event')).toBe('community');
      expect(mapToInternalCategory('Unknown Activity')).toBe('community');
    });
  });
});
