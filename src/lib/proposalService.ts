import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

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
}

export interface CreateProposalParams {
  eventId: string;
  creatorId: string;
  proposedTimes: string[]; // Array of ISO datetime strings
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

    const updates: Partial<ProposalRow> = {
      updated_at: new Date().toISOString(),
    };

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
    // First, update the proposal status
    const { data: proposal, error: updateError } = await supabase
      .from('proposals')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString(),
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
