import type { Database } from '@/integrations/supabase/types';

export type TimeMode = 'fixed' | 'window' | 'anytime';
export type PriceRange = 'free' | '€' | '€€' | '€€€' | '€€€€';
export type EventType = 'anchor' | 'fork' | 'signal';
export type ProposalStatus = 'draft' | 'voting' | 'confirmed' | 'cancelled';
export type VoteType = 'yes' | 'no' | 'maybe';

export interface OpeningPeriod {
  open: string;
  close: string;
  closes_next_day?: boolean;
}

export type OpeningDaySchedule = OpeningPeriod[] | 'closed';

export interface OpeningHours {
  always_open?: boolean;
  monday?: OpeningDaySchedule;
  tuesday?: OpeningDaySchedule;
  wednesday?: OpeningDaySchedule;
  thursday?: OpeningDaySchedule;
  friday?: OpeningDaySchedule;
  saturday?: OpeningDaySchedule;
  sunday?: OpeningDaySchedule;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  time_mode: TimeMode;
  event_type: EventType;
  start_time: string | null;
  end_time: string | null;
  opening_hours: OpeningHours | null;
  location: string;
  google_place_id: string | null;
  contact_phone: string | null;
  website_url: string | null;
  ticket_url: string | null;
  social_links: SocialLinks | null;
  price_range: PriceRange | null;
  parent_event_id: string | null;
  enrichment_attempted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  event_id: string | null;
  venue_place_id: string | null;
  proposed_by: string;
  proposed_time: string | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

export interface ProposalVote {
  id: string;
  proposal_id: string;
  user_id: string;
  vote: VoteType;
  created_at: string;
}

export type EventRow = Database['public']['Tables']['events']['Row'];

export type EventWithUtility = EventRow & {
  time_mode: TimeMode;
  event_type: EventType;
  start_time: string | null;
  end_time: string | null;
  opening_hours: OpeningHours | null;
  google_place_id: string | null;
  contact_phone: string | null;
  website_url: string | null;
  ticket_url: string | null;
  social_links: SocialLinks | null;
  price_range: PriceRange | null;
  parent_event_id: string | null;
  enrichment_attempted_at: string | null;
};
