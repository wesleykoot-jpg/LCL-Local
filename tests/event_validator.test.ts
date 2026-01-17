/**
 * Tests for Event Validator
 * 
 * Tests for validation logic before database insertion
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// VALIDATION CONFIG (copied from validator.ts)
// ============================================================================

interface ScrapedEvent {
  name: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  city?: string;
  address?: string;
  ticket_url?: string;
  website_url?: string;
  price_range?: string;
  image_url?: string;
  category: string;
  source_url: string;
  time_mode?: string;
  coordinates?: { lat: number; lng: number };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationConfig {
  requiredFields: (keyof ScrapedEvent)[];
  minTitleLength: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  allowMissingTime: boolean;
  allowMissingCity: boolean;
  validCategories: string[];
  maxFutureDays: number;
  maxPastDays: number;
}

const DEFAULT_CONFIG: ValidationConfig = {
  requiredFields: ["name", "category", "source_url"],
  minTitleLength: 3,
  maxTitleLength: 500,
  maxDescriptionLength: 5000,
  allowMissingTime: true,
  allowMissingCity: false,
  validCategories: [
    "active", "gaming", "entertainment", "social", "family",
    "outdoors", "music", "workshops", "foodie", "community"
  ],
  maxFutureDays: 365,
  maxPastDays: 1,
};

// ============================================================================
// VALIDATOR IMPLEMENTATION (simplified for testing)
// ============================================================================

function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function validateCoordinates(coords: { lat: number; lng: number }): { isValid: boolean; error?: string } {
  if (typeof coords.lat !== "number" || typeof coords.lng !== "number") {
    return { isValid: false, error: "Coordinates must be numbers" };
  }
  if (coords.lat < -90 || coords.lat > 90) {
    return { isValid: false, error: "Latitude must be between -90 and 90" };
  }
  if (coords.lng < -180 || coords.lng > 180) {
    return { isValid: false, error: "Longitude must be between -180 and 180" };
  }
  if (Math.abs(coords.lat) < 0.0001 && Math.abs(coords.lng) < 0.0001) {
    return { isValid: false, error: "Coordinates appear to be null island (0, 0)" };
  }
  return { isValid: true };
}

function validate(event: ScrapedEvent, config: ValidationConfig = DEFAULT_CONFIG): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields check
  for (const field of config.requiredFields) {
    if (!event[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Title validation
  if (event.name) {
    if (event.name.length < config.minTitleLength) {
      errors.push(`Title too short (min ${config.minTitleLength} characters)`);
    }
    if (event.name.length > config.maxTitleLength) {
      warnings.push(`Title truncated (max ${config.maxTitleLength} characters)`);
    }
  }

  // Description validation
  if (event.description && event.description.length > config.maxDescriptionLength) {
    warnings.push(`Description truncated (max ${config.maxDescriptionLength} characters)`);
  }

  // City validation
  if (!event.city && !config.allowMissingCity) {
    errors.push("City is required");
  }

  // Start time validation
  if (event.start_time) {
    if (!isValidISODate(event.start_time)) {
      errors.push("Invalid start_time: Invalid date format");
    }
  } else if (!config.allowMissingTime) {
    errors.push("start_time is required");
  }

  // Category validation
  if (event.category && !config.validCategories.includes(event.category.toLowerCase())) {
    errors.push(`Invalid category: ${event.category}. Valid categories: ${config.validCategories.join(", ")}`);
  }

  // URL validations
  if (event.source_url && !isValidUrl(event.source_url)) {
    errors.push("Invalid source_url: Invalid URL format");
  }
  if (event.ticket_url && !isValidUrl(event.ticket_url)) {
    errors.push("Invalid ticket_url: Invalid URL format");
  }
  if (event.image_url && !isValidUrl(event.image_url)) {
    warnings.push("Invalid image_url: Invalid URL format");
  }

  // Coordinates validation
  if (event.coordinates) {
    const coordValidation = validateCoordinates(event.coordinates);
    if (!coordValidation.isValid) {
      warnings.push(`Invalid coordinates: ${coordValidation.error}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Event Validator', () => {
  describe('validate', () => {
    const validEvent: ScrapedEvent = {
      name: 'Test Concert',
      description: 'A great concert in Amsterdam',
      start_time: '2026-05-15T20:00:00.000Z',
      venue_name: 'Paradiso',
      city: 'Amsterdam',
      category: 'music',
      source_url: 'https://paradiso.nl/event/test-concert',
    };

    it('should validate a complete valid event', () => {
      const result = validate(validEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when name is missing', () => {
      const event = { ...validEvent, name: '' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    it('should fail when name is too short', () => {
      const event = { ...validEvent, name: 'AB' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Title too short'))).toBe(true);
    });

    it('should fail when category is missing', () => {
      const event = { ...validEvent, category: '' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: category');
    });

    it('should fail when category is invalid', () => {
      const event = { ...validEvent, category: 'invalid-category' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid category'))).toBe(true);
    });

    it('should fail when source_url is missing', () => {
      const event = { ...validEvent, source_url: '' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: source_url');
    });

    it('should fail when source_url is invalid', () => {
      const event = { ...validEvent, source_url: 'not-a-url' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid source_url'))).toBe(true);
    });

    it('should fail when city is missing and not allowed', () => {
      const event = { ...validEvent, city: undefined };
      const result = validate(event, { ...DEFAULT_CONFIG, allowMissingCity: false });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('City is required');
    });

    it('should pass when city is missing but allowed', () => {
      const event = { ...validEvent, city: undefined };
      const result = validate(event, { ...DEFAULT_CONFIG, allowMissingCity: true });
      expect(result.isValid).toBe(true);
    });

    it('should fail when start_time is invalid', () => {
      const event = { ...validEvent, start_time: 'invalid-date' };
      const result = validate(event);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid start_time'))).toBe(true);
    });

    it('should warn about invalid image_url but not fail', () => {
      const event = { ...validEvent, image_url: 'not-a-url' };
      const result = validate(event);
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Invalid image_url'))).toBe(true);
    });

    it('should warn about null island coordinates', () => {
      const event = { ...validEvent, coordinates: { lat: 0, lng: 0 } };
      const result = validate(event);
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('null island'))).toBe(true);
    });

    it('should accept valid coordinates', () => {
      const event = { ...validEvent, coordinates: { lat: 52.3622, lng: 4.8834 } };
      const result = validate(event);
      expect(result.isValid).toBe(true);
      expect(result.warnings.filter(w => w.includes('coordinates'))).toHaveLength(0);
    });

    it('should validate all internal categories', () => {
      const categories = ['active', 'gaming', 'entertainment', 'social', 'family', 'outdoors', 'music', 'workshops', 'foodie', 'community'];
      
      for (const category of categories) {
        const event = { ...validEvent, category };
        const result = validate(event);
        expect(result.isValid).toBe(true);
      }
    });
  });
});
