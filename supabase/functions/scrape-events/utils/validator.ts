/**
 * Event Validator - Data validation before database insertion
 * 
 * Validates required fields, format correctness, and business rules
 * before events are inserted into the database.
 * 
 * @module utils/validator
 */

import type { ScrapedEvent } from "../strategies/base.ts";

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the event is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of warnings (non-blocking issues) */
  warnings: string[];
  /** Sanitized/corrected event data */
  sanitizedEvent?: ScrapedEvent;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Required fields that must be present and non-empty */
  requiredFields: (keyof ScrapedEvent)[];
  /** Minimum title length */
  minTitleLength: number;
  /** Maximum title length */
  maxTitleLength: number;
  /** Maximum description length */
  maxDescriptionLength: number;
  /** Allow events without start_time */
  allowMissingTime: boolean;
  /** Allow events without city */
  allowMissingCity: boolean;
  /** Valid categories */
  validCategories: string[];
  /** Future date limit (in days) - reject events too far in future */
  maxFutureDays: number;
  /** Past date limit (in days) - reject events in the past */
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

/**
 * Event Validator Class
 * 
 * Provides comprehensive validation and sanitization for scraped events.
 */
export class EventValidator {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate a scraped event
   * @param event - Event to validate
   * @returns Validation result with errors, warnings, and sanitized data
   */
  validate(event: ScrapedEvent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create a mutable copy for sanitization
    const sanitized: ScrapedEvent = { ...event };

    // Required fields check
    for (const field of this.config.requiredFields) {
      if (!event[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Title validation
    if (event.name) {
      if (event.name.length < this.config.minTitleLength) {
        errors.push(`Title too short (min ${this.config.minTitleLength} characters)`);
      }
      if (event.name.length > this.config.maxTitleLength) {
        warnings.push(`Title truncated (max ${this.config.maxTitleLength} characters)`);
        sanitized.name = event.name.slice(0, this.config.maxTitleLength);
      }
      // Sanitize title
      sanitized.name = this.sanitizeText(sanitized.name);
    }

    // Description validation and sanitization
    if (event.description) {
      if (event.description.length > this.config.maxDescriptionLength) {
        warnings.push(`Description truncated (max ${this.config.maxDescriptionLength} characters)`);
        sanitized.description = event.description.slice(0, this.config.maxDescriptionLength);
      }
      sanitized.description = this.sanitizeText(sanitized.description);
    }

    // City validation
    if (!event.city && !this.config.allowMissingCity) {
      errors.push("City is required");
    }

    // Start time validation
    if (event.start_time) {
      const startTimeValidation = this.validateDateTime(event.start_time);
      if (!startTimeValidation.isValid) {
        errors.push(`Invalid start_time: ${startTimeValidation.error}`);
      } else if (startTimeValidation.warnings.length > 0) {
        warnings.push(...startTimeValidation.warnings);
      }
    } else if (!this.config.allowMissingTime) {
      errors.push("start_time is required");
    }

    // End time validation
    if (event.end_time) {
      const endTimeValidation = this.validateDateTime(event.end_time);
      if (!endTimeValidation.isValid) {
        errors.push(`Invalid end_time: ${endTimeValidation.error}`);
      }

      // Ensure end_time is after start_time
      if (event.start_time && event.end_time) {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        if (end <= start) {
          warnings.push("end_time is not after start_time");
        }
      }
    }

    // Category validation
    if (event.category && !this.config.validCategories.includes(event.category.toLowerCase())) {
      errors.push(`Invalid category: ${event.category}. Valid categories: ${this.config.validCategories.join(", ")}`);
    } else if (event.category) {
      sanitized.category = event.category.toLowerCase();
    }

    // URL validations
    if (event.source_url) {
      const sourceUrlValidation = this.validateUrl(event.source_url);
      if (!sourceUrlValidation.isValid) {
        errors.push(`Invalid source_url: ${sourceUrlValidation.error}`);
      }
    }

    if (event.ticket_url) {
      const ticketUrlValidation = this.validateUrl(event.ticket_url);
      if (!ticketUrlValidation.isValid) {
        errors.push(`Invalid ticket_url: ${ticketUrlValidation.error}`);
      }
    }

    if (event.website_url) {
      const websiteUrlValidation = this.validateUrl(event.website_url);
      if (!websiteUrlValidation.isValid) {
        warnings.push(`Invalid website_url: ${websiteUrlValidation.error}`);
        sanitized.website_url = undefined;
      }
    }

    if (event.image_url) {
      const imageUrlValidation = this.validateUrl(event.image_url);
      if (!imageUrlValidation.isValid) {
        warnings.push(`Invalid image_url: ${imageUrlValidation.error}`);
        sanitized.image_url = undefined;
      }
    }

    // Coordinates validation
    if (event.coordinates) {
      const coordValidation = this.validateCoordinates(event.coordinates);
      if (!coordValidation.isValid) {
        warnings.push(`Invalid coordinates: ${coordValidation.error}`);
        sanitized.coordinates = undefined;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedEvent: errors.length === 0 ? sanitized : undefined,
    };
  }

  /**
   * Validate multiple events and return statistics
   */
  validateBatch(events: ScrapedEvent[]): {
    results: ValidationResult[];
    stats: { valid: number; invalid: number; validRate: number };
  } {
    const results = events.map(event => this.validate(event));
    const valid = results.filter(r => r.isValid).length;
    const invalid = results.length - valid;
    const validRate = events.length > 0 ? valid / events.length : 0;

    return { results, stats: { valid, invalid, validRate } };
  }

  /**
   * Validate ISO 8601 datetime string
   */
  private validateDateTime(dateStr: string): { isValid: boolean; error?: string; warnings: string[] } {
    const warnings: string[] = [];

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: "Invalid date format", warnings: [] };
      }

      const now = new Date();
      const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Check for events in the past
      if (diffDays < -this.config.maxPastDays) {
        return { isValid: false, error: `Event is ${Math.abs(Math.round(diffDays))} days in the past`, warnings: [] };
      }

      // Check for events too far in future
      if (diffDays > this.config.maxFutureDays) {
        warnings.push(`Event is ${Math.round(diffDays)} days in the future`);
      }

      return { isValid: true, warnings };
    } catch {
      return { isValid: false, error: "Failed to parse date", warnings: [] };
    }
  }

  /**
   * Validate URL format
   */
  private validateUrl(urlStr: string): { isValid: boolean; error?: string } {
    try {
      const url = new URL(urlStr);
      if (!["http:", "https:"].includes(url.protocol)) {
        return { isValid: false, error: "URL must use http or https protocol" };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, error: "Invalid URL format" };
    }
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(coords: { lat: number; lng: number }): { isValid: boolean; error?: string } {
    if (typeof coords.lat !== "number" || typeof coords.lng !== "number") {
      return { isValid: false, error: "Coordinates must be numbers" };
    }

    if (coords.lat < -90 || coords.lat > 90) {
      return { isValid: false, error: "Latitude must be between -90 and 90" };
    }

    if (coords.lng < -180 || coords.lng > 180) {
      return { isValid: false, error: "Longitude must be between -180 and 180" };
    }

    // Check for null island (0, 0) - common default/error value
    if (Math.abs(coords.lat) < 0.0001 && Math.abs(coords.lng) < 0.0001) {
      return { isValid: false, error: "Coordinates appear to be null island (0, 0)" };
    }

    return { isValid: true };
  }

  /**
   * Sanitize text by removing problematic characters
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/<[^>]*>/g, " ")     // Remove HTML tags
      .replace(/\s+/g, " ")          // Normalize whitespace
      .trim();
  }

  /**
   * Check if event has valid start_time
   * Utility for the 90%+ valid start_time requirement
   */
  hasValidStartTime(event: ScrapedEvent): boolean {
    if (!event.start_time) return false;
    const validation = this.validateDateTime(event.start_time);
    return validation.isValid;
  }

  /**
   * Check if event has category assigned
   * Utility for the "all events have category" requirement
   */
  hasCategory(event: ScrapedEvent): boolean {
    return !!event.category && this.config.validCategories.includes(event.category.toLowerCase());
  }
}

/**
 * Quick validation for common checks
 */
export function quickValidate(event: Partial<ScrapedEvent>): { valid: boolean; reason?: string } {
  if (!event.name || event.name.length < 3) {
    return { valid: false, reason: "Missing or invalid name" };
  }
  if (!event.source_url) {
    return { valid: false, reason: "Missing source_url" };
  }
  if (!event.category) {
    return { valid: false, reason: "Missing category" };
  }
  return { valid: true };
}
