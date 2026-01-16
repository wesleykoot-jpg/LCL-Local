import { z } from 'zod';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';

const attendeeProfileSchema = z.object({
  id: z.string(),
  avatar_url: z.string().nullable().default(null),
  full_name: z.string().nullable().default(null),
});

const attendeeSchema = z.object({
  profile: attendeeProfileSchema.nullable(),
});

// Backend can return JSON, strings, or null for location-related fields.
const flexibleValue = z.any();

const eventWithAttendeesSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  event_type: z.string(),
  parent_event_id: z.string().nullable().optional(),
  venue_name: z.string().nullable().optional(),
  location: flexibleValue.nullable().optional(),
  event_date: z.string(),
  event_time: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  match_percentage: z.number().nullable().optional(),
  attendee_count: z.number().nullable().optional(),
  attendees: z.array(attendeeSchema).optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string().optional(),
  source_id: z.string().nullable().optional(),
  event_fingerprint: z.string().nullable().optional(),
  max_attendees: z.number().nullable().optional(),
  structured_date: z.string().nullable().optional(),
  structured_location: flexibleValue.nullable().optional(),
  organizer: z.string().nullable().optional(),
  parent_event: flexibleValue.nullable().optional(),
}).passthrough();

const eventsWithAttendeesSchema = z.array(eventWithAttendeesSchema);

const personalizedFeedRowSchema = z.object({
  event_id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  event_type: z.string(),
  parent_event_id: z.string().nullable().optional(),
  venue_name: z.string().nullable().optional(),
  location: flexibleValue.nullable().optional(),
  event_date: z.string(),
  event_time: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  match_percentage: z.number().nullable().optional(),
  attendee_count: z.number().nullable().optional(),
  host_reliability: z.number().nullable().optional(),
  distance_km: z.number().nullable().optional(),
  final_score: z.number().nullable().optional(),
}).passthrough();

const personalizedFeedResponseSchema = z.array(personalizedFeedRowSchema);

const attendeeRowSchema = z.object({
  event_id: z.string(),
  profile: attendeeProfileSchema.nullable(),
}).passthrough();

const attendeeRowsSchema = z.array(attendeeRowSchema);

const userAttendanceRowSchema = z.object({
  event_id: z.string(),
  profiles: attendeeProfileSchema.nullable(),
}).passthrough();

const userAttendanceRowsSchema = z.array(userAttendanceRowSchema);

export type PersonalizedFeedRow = z.infer<typeof personalizedFeedRowSchema>;
export type AttendeeRow = z.infer<typeof attendeeRowSchema>;
export type UserAttendanceRow = z.infer<typeof userAttendanceRowSchema>;

function handleSchemaFailure(context: string, error: z.ZodError) {
  console.warn(`[schemas] Invalid ${context} data received`, error.flatten());
}

export function parsePersonalizedFeedRows(data: unknown): PersonalizedFeedRow[] {
  const result = personalizedFeedResponseSchema.safeParse(data ?? []);
  if (!result.success) {
    handleSchemaFailure('personalized feed', result.error);
    return [];
  }
  return result.data;
}

export function parseAttendeeRows(data: unknown): AttendeeRow[] {
  const result = attendeeRowsSchema.safeParse(data ?? []);
  if (!result.success) {
    handleSchemaFailure('attendees', result.error);
    return [];
  }
  return result.data;
}

export function parseUserAttendanceRows(data: unknown): UserAttendanceRow[] {
  const result = userAttendanceRowsSchema.safeParse(data ?? []);
  if (!result.success) {
    handleSchemaFailure('user attendance', result.error);
    return [];
  }
  return result.data;
}

export function parseEventsWithAttendees(data: unknown): EventWithAttendees[] {
  const result = eventsWithAttendeesSchema.safeParse(data ?? []);
  if (!result.success) {
    handleSchemaFailure('events', result.error);
    return [];
  }
  return result.data as EventWithAttendees[];
}
