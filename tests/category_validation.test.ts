import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Category Validation Tests
 * 
 * These tests verify that the scraper always produces valid categories
 * that match the database constraint.
 */

// Import the category mapping function and constants
// Note: We're testing the actual deployed code, not mocking
import { INTERNAL_CATEGORIES, classifyTextToCategory } from '../supabase/functions/_shared/categoryMapping.ts';

describe('Category Validation', () => {
  it('should have exactly 10 allowed categories', () => {
    expect(INTERNAL_CATEGORIES).toHaveLength(10);
  });

  it('should include all required categories', () => {
    const required = [
      'active',
      'gaming',
      'entertainment',
      'social',
      'family',
      'outdoors',
      'music',
      'workshops',
      'foodie',
      'community'
    ];
    
    required.forEach(category => {
      expect(INTERNAL_CATEGORIES).toContain(category);
    });
  });

  it('should have categories matching database constraint', () => {
    // These are the exact categories from the database constraint
    const dbCategories = [
      'active',
      'gaming',
      'entertainment',
      'social',
      'family',
      'outdoors',
      'music',
      'workshops',
      'foodie',
      'community'
    ];
    
    expect(INTERNAL_CATEGORIES.sort()).toEqual(dbCategories.sort());
  });

  it('should not contain old legacy categories', () => {
    const legacyCategories = ['cinema', 'crafts', 'sports', 'market', 'nightlife', 'food', 'culture'];
    
    legacyCategories.forEach(legacy => {
      expect(INTERNAL_CATEGORIES).not.toContain(legacy);
    });
  });

  it('should have lowercase categories only', () => {
    INTERNAL_CATEGORIES.forEach(category => {
      expect(category).toBe(category.toLowerCase());
    });
  });
});

describe('Category Mapping Edge Cases', () => {
  it('should return valid category for empty input', () => {
    const result = classifyTextToCategory('');
    expect(INTERNAL_CATEGORIES).toContain(result);
  });

  it('should return valid category for null/undefined input', () => {
    // Test that the function handles invalid inputs gracefully
    // We intentionally bypass TypeScript's type checking here to test runtime behavior
    // when the function receives unexpected inputs (e.g., from external sources)
    const result1 = classifyTextToCategory(null as unknown as string);
    const result2 = classifyTextToCategory(undefined as unknown as string);
    
    // Both should return "community" as the safe default
    expect(result1).toBe('community');
    expect(result2).toBe('community');
    expect(INTERNAL_CATEGORIES).toContain(result1);
    expect(INTERNAL_CATEGORIES).toContain(result2);
  });

  it('should return valid category for whitespace input', () => {
    const result = classifyTextToCategory('   \n\t  ');
    expect(INTERNAL_CATEGORIES).toContain(result);
  });

  it('should return valid category for gibberish input', () => {
    const result = classifyTextToCategory('xyzabc123!@#$%^&*()');
    expect(INTERNAL_CATEGORIES).toContain(result);
  });

  it('should default to community for unrecognized content', () => {
    const result = classifyTextToCategory('completely random unrelated text that matches nothing');
    expect(result).toBe('community');
  });

  it('should handle mixed case input correctly', () => {
    const inputs = [
      'SPORT FITNESS RUNNING',
      'Sport Fitness Running',
      'sport FITNESS running'
    ];
    
    inputs.forEach(input => {
      const result = classifyTextToCategory(input);
      expect(INTERNAL_CATEGORIES).toContain(result);
      expect(result).toBe('active'); // Should map to active based on keywords
    });
  });

  it('should handle Dutch keywords correctly', () => {
    const dutchInputs = [
      'kinderen speeltuin',  // Should map to family
      'concert live muziek', // Should map to music
      'borrel netwerken',    // Should map to social
      'wandeling natuur'     // Should map to outdoors
    ];
    
    dutchInputs.forEach(input => {
      const result = classifyTextToCategory(input);
      expect(INTERNAL_CATEGORIES).toContain(result);
    });
  });

  it('should prioritize Hybrid Life family keywords', () => {
    const familyInputs = [
      'basisschool event',
      'kinderopvang opening',
      'peutergroep activiteit'
    ];
    
    familyInputs.forEach(input => {
      const result = classifyTextToCategory(input);
      expect(result).toBe('family');
    });
  });

  it('should handle very long input strings', () => {
    const longInput = 'a '.repeat(10000) + 'sport fitness';
    const result = classifyTextToCategory(longInput);
    expect(INTERNAL_CATEGORIES).toContain(result);
  });

  it('should handle special characters', () => {
    const result = classifyTextToCategory('🎮 gaming 🎯 esports 🏆');
    expect(INTERNAL_CATEGORIES).toContain(result);
    // Note: The result may vary based on keyword matching, just verify it's valid
  });
});
