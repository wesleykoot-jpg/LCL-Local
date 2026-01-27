import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  calculateVenueSuggestionAnchors,
  type UserLocation,
  type VenueSuggestionAnchors,
} from './geospatial';

type ProposalRow = Database['public']['Tables']['proposals']['Row'];
type ProposalInsert = Database['public']['Tables']['proposals']['Insert'];

export interface Proposal {
  id: string;
  event_id: string;
  creator_id: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  proposed_times: string[]; // ISO datetime strings
  created_at: string;
  updated_at: string;
  /** IDs of invited participants */
  participant_ids?: string[];
}

export interface CreateProposalParams {
  eventId: string;
  creatorId: string;
  proposedTimes: string[]; // Array of ISO datetime strings
  /** Optional array of participant profile IDs to invite */
  participantIds?: string[];
}

/**
 * Participant location data for centroid calculations
 */
export interface ParticipantLocation {
  profileId: string;
  lat: number;
  lng: number;
}

export interface UpdateProposalParams {
  proposalId: string;
  status?: 'draft' | 'confirmed' | 'cancelled';
  proposedTimes?: string[];
}

/**
 * Creates a new proposal for a venue/event
 * @param params - Proposal creation parameters
 * @returns Object with created proposal data and error (if any)
 */
export async function createProposal(params: CreateProposalParams) {
  try {
    const { eventId, creatorId, proposedTimes } = params;

    if (!proposedTimes || proposedTimes.length === 0) {
      throw new Error('At least one proposed time is required');
    }

    const proposal: ProposalInsert = {
      event_id: eventId,
      creator_id: creatorId,
      status: 'draft',
      proposed_times: proposedTimes,
    };

    const { data, error } = await supabase
      .from('proposals')
      .insert(proposal)
      .select()
      .single();

    if (error) throw error;

    return { 
      data: mapProposal(data), 
      error: null 
    };
  } catch (error) {
    console.error('Error creating proposal:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Gets all proposals for a specific event/venue
 * @param eventId - ID of the event/venue
 * @returns Object with proposals array and error (if any)
 */
export async function getProposalsByEvent(eventId: string) {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { 
      data: (data || []).map(mapProposal), 
      error: null 
    };
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * Gets all proposals created by a specific user
 * @param creatorId - Profile ID of the creator
 * @returns Object with proposals array and error (if any)
 */
export async function getProposalsByCreator(creatorId: string) {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select(`
        *,
        event:events(*)
      `)
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { 
      data: (data || []).map(row => ({
        ...mapProposal(row),
        event: row.event,
      })), 
      error: null 
    };
  } catch (error) {
    console.error('Error fetching user proposals:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * Updates an existing proposal
 * @param params - Update parameters
 * @returns Object with updated proposal and error (if any)
 */
export async function updateProposal(params: UpdateProposalParams) {
  try {
    const { proposalId, status, proposedTimes } = params;

    const updates: Partial<ProposalRow> = {};

    if (status) {
      updates.status = status;
    }

    if (proposedTimes) {
      updates.proposed_times = proposedTimes;
    }

    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', proposalId)
      .select()
      .single();

    if (error) throw error;

    return { 
      data: mapProposal(data), 
      error: null 
    };
  } catch (error) {
    console.error('Error updating proposal:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Confirms a proposal and optionally creates a child event
 * @param proposalId - ID of the proposal to confirm
 * @param selectedTime - The selected time from proposed_times
 * @returns Object with updated proposal and created child event (if applicable)
 */
export async function confirmProposal(proposalId: string, selectedTime: string) {
  try {
    // First, update the proposal status (updated_at is handled by database trigger)
    const { data: proposal, error: updateError } = await supabase
      .from('proposals')
      .update({ 
        status: 'confirmed',
      })
      .eq('id', proposalId)
      .select(`
        *,
        event:events(*)
      `)
      .single();

    if (updateError) throw updateError;

    // The child event creation will be handled separately
    // when the user confirms and creates the actual meetup
    
    return { 
      data: {
        proposal: mapProposal(proposal),
        selectedTime,
        parentEvent: proposal.event,
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Error confirming proposal:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Deletes a proposal
 * @param proposalId - ID of the proposal to delete
 * @returns Object with success status and error (if any)
 */
export async function deleteProposal(proposalId: string) {
  try {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', proposalId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting proposal:', error);
    return { success: false, error: error as Error };
  }
}

/**
 * Maps database row to Proposal interface
 */
function mapProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    event_id: row.event_id,
    creator_id: row.creator_id,
    status: row.status as Proposal['status'],
    proposed_times: Array.isArray(row.proposed_times) 
      ? (row.proposed_times as string[]) 
      : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Fetches participant locations from their profile coordinates
 * @param participantIds - Array of profile IDs
 * @returns Array of participant locations with coordinates
 */
export async function fetchParticipantLocations(
  participantIds: string[]
): Promise<ParticipantLocation[]> {
  if (participantIds.length === 0) {
    return [];
  }

  // Validate participant IDs are valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validIds = participantIds.filter((id) => uuidRegex.test(id));
  
  if (validIds.length === 0) {
    console.warn('No valid UUID participant IDs provided');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, location_coordinates')
      .in('id', validIds);

    if (error) throw error;

    // Filter out profiles without location coordinates and parse the PostGIS point
    return (data || [])
      .filter((profile) => profile.location_coordinates)
      .map((profile) => {
        // Parse PostGIS POINT format: "POINT(lng lat)" or geography object
        const coords = parsePostGISPoint(profile.location_coordinates as string);
        if (!coords) return null;

        return {
          profileId: profile.id,
          lat: coords.lat,
          lng: coords.lng,
        };
      })
      .filter((loc): loc is ParticipantLocation => loc !== null);
  } catch (error) {
    console.error('Error fetching participant locations:', error);
    return [];
  }
}

/**
 * Parses a PostGIS POINT string into lat/lng coordinates
 * @param point - PostGIS POINT string like "POINT(lng lat)" or "0101000020E6100000..."
 * @returns Object with lat/lng or null if invalid
 */
function parsePostGISPoint(point: string | unknown): { lat: number; lng: number } | null {
  if (!point || typeof point !== 'string') {
    return null;
  }

  // Match POINT(lng lat) format with robust numeric pattern
  // Handles: integers, decimals, negative values, scientific notation
  const numPattern = '(-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)';
  const pointRegex = new RegExp(`POINT\\s*\\(\\s*${numPattern}\\s+${numPattern}\\s*\\)`, 'i');
  const match = point.match(pointRegex);
  
  if (match) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Calculates venue suggestion anchors for a group proposal.
 * 
 * This is the main entry point for the "Fairness Engine" that determines
 * optimal meeting points for a group of participants.
 * 
 * @param hostId - Profile ID of the host/initiator
 * @param participantIds - Array of all participant profile IDs (including host)
 * @returns Venue suggestion anchors or null if insufficient location data
 * 
 * @example
 * const anchors = await calculateProposalAnchors('host-id', ['host-id', 'user2', 'user3']);
 * if (anchors) {
 *   // Use anchors.hostLocation, anchors.fairMeetPoint, anchors.hubLocation
 *   // to fetch nearby venues from Supabase
 * }
 */
export async function calculateProposalAnchors(
  hostId: string,
  participantIds: string[]
): Promise<VenueSuggestionAnchors | null> {
  try {
    // Fetch participant locations
    const locations = await fetchParticipantLocations(participantIds);

    // Need at least the host's location
    if (locations.length === 0) {
      console.warn('No participant locations found for centroid calculation');
      return null;
    }

    // Convert to UserLocation format
    const userLocations: UserLocation[] = locations.map((loc) => ({
      id: loc.profileId,
      lat: loc.lat,
      lng: loc.lng,
    }));

    // Verify host is in the locations
    const hostInLocations = userLocations.some((u) => u.id === hostId);
    if (!hostInLocations) {
      console.warn('Host location not found in participant locations');
      return null;
    }

    // Calculate venue suggestion anchors
    return calculateVenueSuggestionAnchors(hostId, userLocations);
  } catch (error) {
    console.error('Error calculating proposal anchors:', error);
    return null;
  }
}

/**
 * Re-export geospatial types for convenience
 */
export type { UserLocation, VenueSuggestionAnchors } from './geospatial';
