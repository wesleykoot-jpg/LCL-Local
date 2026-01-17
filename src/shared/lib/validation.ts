import { z } from 'zod';

/**
 * Validation schemas for user inputs
 * These schemas ensure data integrity and security before sending to Supabase
 */

// Event creation validation schema
export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  category: z.enum(['cinema', 'market', 'crafts', 'sports', 'gaming']),
  event_type: z.enum(['anchor', 'fork', 'signal']),
  event_date: z.string().min(1, 'Date is required'),
  event_time: z.string().min(1, 'Time is required'),
  venue_name: z
    .string()
    .min(2, 'Venue name must be at least 2 characters')
    .max(200, 'Venue name must be less than 200 characters')
    .trim(),
  max_attendees: z.number().int().min(0).max(10000),
  is_private: z.boolean().optional(),
  invited_user_ids: z.array(z.string().uuid()).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

// Profile update validation schema
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional(),
  location_city: z
    .string()
    .max(100, 'City name must be less than 100 characters')
    .trim()
    .nullable()
    .optional(),
  location_country: z
    .string()
    .max(100, 'Country name must be less than 100 characters')
    .trim()
    .nullable()
    .optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
  current_persona: z.enum(['family', 'gamer']).optional(),
  profile_complete: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Sign up validation schema
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * Validates and sanitizes user input
 * Removes potentially dangerous characters and limits length
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 1000); // Limit to 1000 characters
}
