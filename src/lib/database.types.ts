export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          location_city: string | null
          location_country: string | null
          location_coordinates: unknown | null
          location_lat: number | null
          location_lng: number | null
          avatar_url: string | null
          reliability_score: number | null
          events_attended: number | null
          events_committed: number | null
          current_persona: string | null
          verified_resident: boolean | null
          user_id: string | null
          profile_complete: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          full_name: string
          location_city?: string | null
          location_country?: string | null
          location_coordinates?: unknown | null
          location_lat?: number | null
          location_lng?: number | null
          avatar_url?: string | null
          reliability_score?: number | null
          events_attended?: number | null
          events_committed?: number | null
          current_persona?: string | null
          verified_resident?: boolean | null
          user_id?: string | null
          profile_complete?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          location_city?: string | null
          location_country?: string | null
          location_coordinates?: unknown | null
          location_lat?: number | null
          location_lng?: number | null
          avatar_url?: string | null
          reliability_score?: number | null
          events_attended?: number | null
          events_committed?: number | null
          current_persona?: string | null
          verified_resident?: boolean | null
          user_id?: string | null
          profile_complete?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      persona_stats: {
        Row: {
          id: string
          profile_id: string
          persona_type: string
          rallies_hosted: number | null
          newcomers_welcomed: number | null
          host_rating: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          persona_type: string
          rallies_hosted?: number | null
          newcomers_welcomed?: number | null
          host_rating?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          persona_type?: string
          rallies_hosted?: number | null
          newcomers_welcomed?: number | null
          host_rating?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      persona_badges: {
        Row: {
          id: string
          profile_id: string
          persona_type: string
          badge_name: string
          badge_level: string
          badge_icon: string
          earned_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          persona_type: string
          badge_name: string
          badge_level: string
          badge_icon: string
          earned_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          persona_type?: string
          badge_name?: string
          badge_level?: string
          badge_icon?: string
          earned_at?: string | null
        }
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          category: string
          event_type: string
          parent_event_id: string | null
          venue_name: string
          location: unknown
          event_date: string
          event_time: string
          status: string | null
          image_url: string | null
          match_percentage: number | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category: string
          event_type: string
          parent_event_id?: string | null
          venue_name: string
          location: unknown
          event_date: string
          event_time: string
          status?: string | null
          image_url?: string | null
          match_percentage?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          category?: string
          event_type?: string
          parent_event_id?: string | null
          venue_name?: string
          location?: unknown
          event_date?: string
          event_time?: string
          status?: string | null
          image_url?: string | null
          match_percentage?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      event_attendees: {
        Row: {
          id: string
          event_id: string
          profile_id: string
          status: string | null
          ticket_number: string | null
          checked_in: boolean | null
          joined_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          profile_id: string
          status?: string | null
          ticket_number?: string | null
          checked_in?: boolean | null
          joined_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          profile_id?: string
          status?: string | null
          ticket_number?: string | null
          checked_in?: boolean | null
          joined_at?: string | null
        }
      }
      calendar_integrations: {
        Row: {
          id: string
          profile_id: string
          provider: string
          access_token: string | null
          refresh_token: string | null
          token_expiry: string | null
          calendar_id: string | null
          sync_enabled: boolean | null
          last_sync: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          provider: string
          access_token?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
          calendar_id?: string | null
          sync_enabled?: boolean | null
          last_sync?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          provider?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
          calendar_id?: string | null
          sync_enabled?: boolean | null
          last_sync?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      calendar_event_mappings: {
        Row: {
          id: string
          event_id: string
          profile_id: string
          integration_id: string
          external_event_id: string
          external_calendar_id: string
          last_synced_at: string | null
          sync_status: string | null
          error_message: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          profile_id: string
          integration_id: string
          external_event_id: string
          external_calendar_id: string
          last_synced_at?: string | null
          sync_status?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          profile_id?: string
          integration_id?: string
          external_event_id?: string
          external_calendar_id?: string
          last_synced_at?: string | null
          sync_status?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
