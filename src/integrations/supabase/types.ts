export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_job_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["ai_job_type_enum"]
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          payload: Json
          priority: number | null
          related_id: string | null
          result: Json | null
          status: Database["public"]["Enums"]["ai_job_status_enum"] | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["ai_job_type_enum"]
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          payload: Json
          priority?: number | null
          related_id?: string | null
          result?: Json | null
          status?: Database["public"]["Enums"]["ai_job_status_enum"] | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["ai_job_type_enum"]
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          payload?: Json
          priority?: number | null
          related_id?: string | null
          result?: Json | null
          status?: Database["public"]["Enums"]["ai_job_status_enum"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      circuit_breaker_state: {
        Row: {
          consecutive_opens: number | null
          cooldown_until: string | null
          created_at: string | null
          failure_count: number | null
          last_failure_at: string | null
          last_success_at: string | null
          opened_at: string | null
          source_id: string
          state: Database["public"]["Enums"]["circuit_state_enum"] | null
          success_count: number | null
          updated_at: string | null
        }
        Insert: {
          consecutive_opens?: number | null
          cooldown_until?: string | null
          created_at?: string | null
          failure_count?: number | null
          last_failure_at?: string | null
          last_success_at?: string | null
          opened_at?: string | null
          source_id: string
          state?: Database["public"]["Enums"]["circuit_state_enum"] | null
          success_count?: number | null
          updated_at?: string | null
        }
        Update: {
          consecutive_opens?: number | null
          cooldown_until?: string | null
          created_at?: string | null
          failure_count?: number | null
          last_failure_at?: string | null
          last_success_at?: string | null
          opened_at?: string | null
          source_id?: string
          state?: Database["public"]["Enums"]["circuit_state_enum"] | null
          success_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circuit_breaker_state_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circuit_breaker_state_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "source_health_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          admin1_code: string | null
          continent: string | null
          country_code: string
          created_at: string | null
          discovery_status: string | null
          geoname_id: number | null
          id: string
          last_discovery_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          population: number | null
          priority_tier: number | null
          timezone: string | null
        }
        Insert: {
          admin1_code?: string | null
          continent?: string | null
          country_code: string
          created_at?: string | null
          discovery_status?: string | null
          geoname_id?: number | null
          id?: string
          last_discovery_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          population?: number | null
          priority_tier?: number | null
          timezone?: string | null
        }
        Update: {
          admin1_code?: string | null
          continent?: string | null
          country_code?: string
          created_at?: string | null
          discovery_status?: string | null
          geoname_id?: number | null
          id?: string
          last_discovery_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          population?: number | null
          priority_tier?: number | null
          timezone?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          event_id: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_jobs: {
        Row: {
          attempts: number | null
          batch_id: string | null
          completed_at: string | null
          coordinates: Json | null
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          municipality: string
          population: number | null
          priority: number | null
          province: string | null
          sources_added: number | null
          sources_found: number | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          batch_id?: string | null
          completed_at?: string | null
          coordinates?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          municipality: string
          population?: number | null
          priority?: number | null
          province?: string | null
          sources_added?: number | null
          sources_found?: number | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          batch_id?: string | null
          completed_at?: string | null
          coordinates?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          municipality?: string
          population?: number | null
          priority?: number | null
          province?: string | null
          sources_added?: number | null
          sources_found?: number | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dutch_municipalities: {
        Row: {
          id: string
          lat: number | null
          lng: number | null
          name: string
          nl_tier: Database["public"]["Enums"]["nl_tier_enum"] | null
          population: number
          province: string | null
        }
        Insert: {
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          nl_tier?: Database["public"]["Enums"]["nl_tier_enum"] | null
          population: number
          province?: string | null
        }
        Update: {
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          nl_tier?: Database["public"]["Enums"]["nl_tier_enum"] | null
          population?: number
          province?: string | null
        }
        Relationships: []
      }
      enrichment_logs: {
        Row: {
          api_calls_used: number | null
          created_at: string
          data_enriched: Json | null
          error_message: string | null
          event_id: string | null
          id: string
          source: string | null
          status: string
        }
        Insert: {
          api_calls_used?: number | null
          created_at?: string
          data_enriched?: Json | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          source?: string | null
          status: string
        }
        Update: {
          api_calls_used?: number | null
          created_at?: string
          data_enriched?: Json | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_code: string | null
          error_type: string | null
          function_name: string | null
          id: string
          level: string
          message: string
          request_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          source: string
          stack_trace: string | null
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_type?: string | null
          function_name?: string | null
          id?: string
          level?: string
          message: string
          request_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          source: string
          stack_trace?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_type?: string | null
          function_name?: string | null
          id?: string
          level?: string
          message?: string
          request_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          source?: string
          stack_trace?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          checked_in: boolean | null
          event_id: string
          id: string
          joined_at: string | null
          profile_id: string
          status: string | null
          ticket_number: string | null
        }
        Insert: {
          checked_in?: boolean | null
          event_id: string
          id?: string
          joined_at?: string | null
          profile_id: string
          status?: string | null
          ticket_number?: string | null
        }
        Update: {
          checked_in?: boolean | null
          event_id?: string
          id?: string
          joined_at?: string | null
          profile_id?: string
          status?: string | null
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookmarks: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_bookmarks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookmarks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invited_by: string
          invited_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invited_by: string
          invited_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_source_urls: string[] | null
          category: string
          contact_phone: string | null
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          doors_open_time: string | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
          embedding_version: number | null
          end_time: string | null
          enrichment_attempted_at: string | null
          event_date: string | null
          event_fingerprint: string | null
          event_time: string
          event_type: string
          google_place_id: string | null
          id: string
          image_url: string | null
          interaction_mode: string | null
          is_private: boolean
          language_profile: string | null
          last_healed_at: string | null
          location: unknown
          match_percentage: number | null
          max_attendees: number | null
          opening_hours: Json | null
          parent_event_id: string | null
          persona_tags: string[] | null
          price_range: string | null
          quality_score: number | null
          social_five_score: number | null
          social_links: Json | null
          source_id: string | null
          source_url: string | null
          start_time: string | null
          status: string | null
          structured_address: Json | null
          tags: string[] | null
          ticket_url: string | null
          time_mode: Database["public"]["Enums"]["time_mode"] | null
          title: string
          updated_at: string | null
          venue_name: string
          website_url: string | null
        }
        Insert: {
          all_source_urls?: string[] | null
          category: string
          contact_phone?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doors_open_time?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          embedding_version?: number | null
          end_time?: string | null
          enrichment_attempted_at?: string | null
          event_date?: string | null
          event_fingerprint?: string | null
          event_time: string
          event_type: string
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          interaction_mode?: string | null
          is_private?: boolean
          language_profile?: string | null
          last_healed_at?: string | null
          location: unknown
          match_percentage?: number | null
          max_attendees?: number | null
          opening_hours?: Json | null
          parent_event_id?: string | null
          persona_tags?: string[] | null
          price_range?: string | null
          quality_score?: number | null
          social_five_score?: number | null
          social_links?: Json | null
          source_id?: string | null
          source_url?: string | null
          start_time?: string | null
          status?: string | null
          structured_address?: Json | null
          tags?: string[] | null
          ticket_url?: string | null
          time_mode?: Database["public"]["Enums"]["time_mode"] | null
          title: string
          updated_at?: string | null
          venue_name: string
          website_url?: string | null
        }
        Update: {
          all_source_urls?: string[] | null
          category?: string
          contact_phone?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doors_open_time?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          embedding_version?: number | null
          end_time?: string | null
          enrichment_attempted_at?: string | null
          event_date?: string | null
          event_fingerprint?: string | null
          event_time?: string
          event_type?: string
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          interaction_mode?: string | null
          is_private?: boolean
          language_profile?: string | null
          last_healed_at?: string | null
          location?: unknown
          match_percentage?: number | null
          max_attendees?: number | null
          opening_hours?: Json | null
          parent_event_id?: string | null
          persona_tags?: string[] | null
          price_range?: string | null
          quality_score?: number | null
          social_five_score?: number | null
          social_links?: Json | null
          source_id?: string | null
          source_url?: string | null
          start_time?: string | null
          status?: string | null
          structured_address?: Json | null
          tags?: string[] | null
          ticket_url?: string | null
          time_mode?: Database["public"]["Enums"]["time_mode"] | null
          title?: string
          updated_at?: string | null
          venue_name?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          lat: number
          lng: number
          venue_key: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          lat: number
          lng: number
          venue_key: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          lat?: number
          lng?: number
          venue_key?: string
        }
        Relationships: []
      }
      google_calendar_events: {
        Row: {
          created_at: string | null
          event_id: string
          google_event_id: string
          id: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          google_event_id: string
          id?: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          google_event_id?: string
          id?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          id: string
          profile_id: string
          refresh_token: string | null
          token_expiry: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          profile_id: string
          refresh_token?: string | null
          token_expiry: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string
          refresh_token?: string | null
          token_expiry?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      net_http_responses_audit: {
        Row: {
          body: Json | null
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          headers: Json | null
          id: number
          method: string | null
          request_id: string | null
          started_at: string | null
          status: number | null
          url: string | null
        }
        Insert: {
          body?: Json | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          headers?: Json | null
          id?: number
          method?: string | null
          request_id?: string | null
          started_at?: string | null
          status?: number | null
          url?: string | null
        }
        Update: {
          body?: Json | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          headers?: Json | null
          id?: number
          method?: string | null
          request_id?: string | null
          started_at?: string | null
          status?: number | null
          url?: string | null
        }
        Relationships: []
      }
      persona_badges: {
        Row: {
          badge_icon: string
          badge_level: string
          badge_name: string
          earned_at: string | null
          id: string
          persona_type: string
          profile_id: string
        }
        Insert: {
          badge_icon: string
          badge_level: string
          badge_name: string
          earned_at?: string | null
          id?: string
          persona_type: string
          profile_id: string
        }
        Update: {
          badge_icon?: string
          badge_level?: string
          badge_name?: string
          earned_at?: string | null
          id?: string
          persona_type?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_stats: {
        Row: {
          created_at: string | null
          host_rating: number | null
          id: string
          newcomers_welcomed: number | null
          persona_type: string
          profile_id: string
          rallies_hosted: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          host_rating?: number | null
          id?: string
          newcomers_welcomed?: number | null
          persona_type: string
          profile_id: string
          rallies_hosted?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          host_rating?: number | null
          id?: string
          newcomers_welcomed?: number | null
          persona_type?: string
          profile_id?: string
          rallies_hosted?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_persona: string | null
          events_attended: number | null
          events_committed: number | null
          full_name: string
          id: string
          location_city: string | null
          location_coordinates: unknown
          location_country: string | null
          profile_complete: boolean | null
          reliability_score: number | null
          updated_at: string | null
          user_id: string | null
          verified_resident: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_persona?: string | null
          events_attended?: number | null
          events_committed?: number | null
          full_name: string
          id?: string
          location_city?: string | null
          location_coordinates?: unknown
          location_country?: string | null
          profile_complete?: boolean | null
          reliability_score?: number | null
          updated_at?: string | null
          user_id?: string | null
          verified_resident?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_persona?: string | null
          events_attended?: number | null
          events_committed?: number | null
          full_name?: string
          id?: string
          location_city?: string | null
          location_coordinates?: unknown
          location_country?: string | null
          profile_complete?: boolean | null
          reliability_score?: number | null
          updated_at?: string | null
          user_id?: string | null
          verified_resident?: boolean | null
        }
        Relationships: []
      }
      proposal_votes: {
        Row: {
          created_at: string
          id: string
          proposal_id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposal_id: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          proposal_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          event_id: string
          id: string
          proposed_time: string | null
          proposed_times: Json
          status: string
          title: string | null
          updated_at: string
          venue_place_id: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          event_id: string
          id?: string
          proposed_time?: string | null
          proposed_times: Json
          status?: string
          title?: string | null
          updated_at?: string
          venue_place_id?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          event_id?: string
          id?: string
          proposed_time?: string | null
          proposed_times?: Json
          status?: string
          title?: string | null
          updated_at?: string
          venue_place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_event_staging: {
        Row: {
          accessibility: string | null
          age_restriction: string | null
          category: string | null
          content_hash: string | null
          coordinates: Json | null
          created_at: string | null
          data_completeness: number | null
          description: string | null
          detail_html: string | null
          detail_url: string | null
          doors_open_time: string | null
          end_date: string | null
          end_time: string | null
          event_date: string | null
          event_fingerprint: string | null
          event_time: string | null
          id: string
          image_url: string | null
          interaction_mode:
            | Database["public"]["Enums"]["interaction_mode_enum"]
            | null
          language_profile:
            | Database["public"]["Enums"]["language_profile_enum"]
            | null
          last_error: string | null
          organizer: string | null
          parsing_method: string | null
          performer: string | null
          persona_tags: string[] | null
          price: string | null
          price_max_cents: number | null
          price_min_cents: number | null
          processing_started_at: string | null
          quality_score: number | null
          raw_html: string | null
          retry_count: number | null
          source_id: string
          source_url: string
          status: Database["public"]["Enums"]["pipeline_status_enum"] | null
          tickets_url: string | null
          title: string | null
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          accessibility?: string | null
          age_restriction?: string | null
          category?: string | null
          content_hash?: string | null
          coordinates?: Json | null
          created_at?: string | null
          data_completeness?: number | null
          description?: string | null
          detail_html?: string | null
          detail_url?: string | null
          doors_open_time?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string | null
          event_fingerprint?: string | null
          event_time?: string | null
          id?: string
          image_url?: string | null
          interaction_mode?:
            | Database["public"]["Enums"]["interaction_mode_enum"]
            | null
          language_profile?:
            | Database["public"]["Enums"]["language_profile_enum"]
            | null
          last_error?: string | null
          organizer?: string | null
          parsing_method?: string | null
          performer?: string | null
          persona_tags?: string[] | null
          price?: string | null
          price_max_cents?: number | null
          price_min_cents?: number | null
          processing_started_at?: string | null
          quality_score?: number | null
          raw_html?: string | null
          retry_count?: number | null
          source_id: string
          source_url: string
          status?: Database["public"]["Enums"]["pipeline_status_enum"] | null
          tickets_url?: string | null
          title?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          accessibility?: string | null
          age_restriction?: string | null
          category?: string | null
          content_hash?: string | null
          coordinates?: Json | null
          created_at?: string | null
          data_completeness?: number | null
          description?: string | null
          detail_html?: string | null
          detail_url?: string | null
          doors_open_time?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string | null
          event_fingerprint?: string | null
          event_time?: string | null
          id?: string
          image_url?: string | null
          interaction_mode?:
            | Database["public"]["Enums"]["interaction_mode_enum"]
            | null
          language_profile?:
            | Database["public"]["Enums"]["language_profile_enum"]
            | null
          last_error?: string | null
          organizer?: string | null
          parsing_method?: string | null
          performer?: string | null
          persona_tags?: string[] | null
          price?: string | null
          price_max_cents?: number | null
          price_min_cents?: number | null
          processing_started_at?: string | null
          quality_score?: number | null
          raw_html?: string | null
          retry_count?: number | null
          source_id?: string
          source_url?: string
          status?: Database["public"]["Enums"]["pipeline_status_enum"] | null
          tickets_url?: string | null
          title?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_event_staging_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_event_staging_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_health_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_pages: {
        Row: {
          content_hash: string | null
          created_at: string | null
          fetch_duration_ms: number | null
          fetcher_used: Database["public"]["Enums"]["fetcher_type_enum"] | null
          final_url: string | null
          headers: Json | null
          html: string | null
          id: string
          source_id: string
          status_code: number | null
          url: string
          version: number | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          fetch_duration_ms?: number | null
          fetcher_used?: Database["public"]["Enums"]["fetcher_type_enum"] | null
          final_url?: string | null
          headers?: Json | null
          html?: string | null
          id?: string
          source_id: string
          status_code?: number | null
          url: string
          version?: number | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          fetch_duration_ms?: number | null
          fetcher_used?: Database["public"]["Enums"]["fetcher_type_enum"] | null
          final_url?: string | null
          headers?: Json | null
          html?: string | null
          id?: string
          source_id?: string
          status_code?: number | null
          url?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_pages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_pages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_health_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_insights: {
        Row: {
          ai_calls_made: number | null
          ai_calls_rate_limited: number | null
          ai_tokens_used: number | null
          error_types: Json | null
          events_deduplicated: number | null
          events_discovered: number | null
          events_enriched: number | null
          events_failed: number | null
          events_persisted: number | null
          health_delta: number | null
          id: string
          metadata: Json | null
          run_duration_ms: number | null
          run_timestamp: string | null
          social_five_complete: number | null
          source_id: string | null
        }
        Insert: {
          ai_calls_made?: number | null
          ai_calls_rate_limited?: number | null
          ai_tokens_used?: number | null
          error_types?: Json | null
          events_deduplicated?: number | null
          events_discovered?: number | null
          events_enriched?: number | null
          events_failed?: number | null
          events_persisted?: number | null
          health_delta?: number | null
          id?: string
          metadata?: Json | null
          run_duration_ms?: number | null
          run_timestamp?: string | null
          social_five_complete?: number | null
          source_id?: string | null
        }
        Update: {
          ai_calls_made?: number | null
          ai_calls_rate_limited?: number | null
          ai_tokens_used?: number | null
          error_types?: Json | null
          events_deduplicated?: number | null
          events_discovered?: number | null
          events_enriched?: number | null
          events_failed?: number | null
          events_persisted?: number | null
          health_delta?: number | null
          id?: string
          metadata?: Json | null
          run_duration_ms?: number | null
          run_timestamp?: string | null
          social_five_complete?: number | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_insights_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_insights_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_health_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_sources: {
        Row: {
          auto_disabled: boolean | null
          consecutive_failures: number | null
          consecutive_successes: number | null
          country: string | null
          created_at: string | null
          default_coordinates: Json | null
          detected_cms: string | null
          detected_framework_version: string | null
          detected_render_strategy:
            | Database["public"]["Enums"]["fetcher_type_enum"]
            | null
          domain: string | null
          dynamic_rate_limit_ms: number | null
          enabled: boolean | null
          fetcher_config: Json | null
          health_last_updated_at: string | null
          health_score: number
          id: string
          language: string | null
          last_payload_hash: string | null
          last_scraped_at: string | null
          last_working_selectors: Json | null
          name: string
          next_scrape_at: string | null
          nl_tier: Database["public"]["Enums"]["nl_tier_enum"] | null
          preferred_method: string | null
          quarantined_at: string | null
          rate_limit_expires_at: string | null
          rate_limit_ms: number | null
          requires_proxy: boolean | null
          scrape_frequency_hours: number | null
          selectors_config: Json | null
          total_skipped_runs: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          auto_disabled?: boolean | null
          consecutive_failures?: number | null
          consecutive_successes?: number | null
          country?: string | null
          created_at?: string | null
          default_coordinates?: Json | null
          detected_cms?: string | null
          detected_framework_version?: string | null
          detected_render_strategy?:
            | Database["public"]["Enums"]["fetcher_type_enum"]
            | null
          domain?: string | null
          dynamic_rate_limit_ms?: number | null
          enabled?: boolean | null
          fetcher_config?: Json | null
          health_last_updated_at?: string | null
          health_score?: number
          id?: string
          language?: string | null
          last_payload_hash?: string | null
          last_scraped_at?: string | null
          last_working_selectors?: Json | null
          name: string
          next_scrape_at?: string | null
          nl_tier?: Database["public"]["Enums"]["nl_tier_enum"] | null
          preferred_method?: string | null
          quarantined_at?: string | null
          rate_limit_expires_at?: string | null
          rate_limit_ms?: number | null
          requires_proxy?: boolean | null
          scrape_frequency_hours?: number | null
          selectors_config?: Json | null
          total_skipped_runs?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          auto_disabled?: boolean | null
          consecutive_failures?: number | null
          consecutive_successes?: number | null
          country?: string | null
          created_at?: string | null
          default_coordinates?: Json | null
          detected_cms?: string | null
          detected_framework_version?: string | null
          detected_render_strategy?:
            | Database["public"]["Enums"]["fetcher_type_enum"]
            | null
          domain?: string | null
          dynamic_rate_limit_ms?: number | null
          enabled?: boolean | null
          fetcher_config?: Json | null
          health_last_updated_at?: string | null
          health_score?: number
          id?: string
          language?: string | null
          last_payload_hash?: string | null
          last_scraped_at?: string | null
          last_working_selectors?: Json | null
          name?: string
          next_scrape_at?: string | null
          nl_tier?: Database["public"]["Enums"]["nl_tier_enum"] | null
          preferred_method?: string | null
          quarantined_at?: string | null
          rate_limit_expires_at?: string | null
          rate_limit_ms?: number | null
          requires_proxy?: boolean | null
          scrape_frequency_hours?: number | null
          selectors_config?: Json | null
          total_skipped_runs?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      selector_healing_log: {
        Row: {
          ai_reasoning: string | null
          applied_at: string | null
          created_at: string | null
          events_extracted_after: number | null
          events_extracted_before: number | null
          id: string
          new_selectors: Json
          old_selectors: Json
          reverted_at: string | null
          source_id: string
          test_successful: boolean | null
        }
        Insert: {
          ai_reasoning?: string | null
          applied_at?: string | null
          created_at?: string | null
          events_extracted_after?: number | null
          events_extracted_before?: number | null
          id?: string
          new_selectors: Json
          old_selectors: Json
          reverted_at?: string | null
          source_id: string
          test_successful?: boolean | null
        }
        Update: {
          ai_reasoning?: string | null
          applied_at?: string | null
          created_at?: string | null
          events_extracted_after?: number | null
          events_extracted_before?: number | null
          id?: string
          new_selectors?: Json
          old_selectors?: Json
          reverted_at?: string | null
          source_id?: string
          test_successful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "selector_healing_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selector_healing_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_health_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_relationships: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_relationships_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_relationships_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_venues: {
        Row: {
          address: string | null
          aliases: string[] | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          location: unknown
          name: string
        }
        Insert: {
          address?: string | null
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          location?: unknown
          name: string
        }
        Update: {
          address?: string | null
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          location?: unknown
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      source_health_dashboard: {
        Row: {
          circuit_failures: number | null
          circuit_state:
            | Database["public"]["Enums"]["circuit_state_enum"]
            | null
          consecutive_failures: number | null
          consecutive_successes: number | null
          cooldown_until: string | null
          detected_render_strategy:
            | Database["public"]["Enums"]["fetcher_type_enum"]
            | null
          domain: string | null
          enabled: boolean | null
          health_score: number | null
          id: string | null
          is_quarantined: boolean | null
          last_scraped_at: string | null
          name: string | null
          next_scrape_at: string | null
          nl_tier: Database["public"]["Enums"]["nl_tier_enum"] | null
          status: string | null
          url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      activate_scout: {
        Args: { p_recipe: Json; p_source_id: string }
        Returns: undefined
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      check_and_heal_fetcher: {
        Args: {
          p_events_found: number
          p_http_status: number
          p_source_id: string
        }
        Returns: Json
      }
      check_and_trigger_re_scout: {
        Args: {
          p_events_found: number
          p_http_status: number
          p_source_id: string
        }
        Returns: Json
      }
      claim_ai_jobs: {
        Args: {
          p_batch_size?: number
          p_job_type?: Database["public"]["Enums"]["ai_job_type_enum"]
        }
        Returns: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["ai_job_type_enum"]
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          payload: Json
          priority: number | null
          related_id: string | null
          result: Json | null
          status: Database["public"]["Enums"]["ai_job_status_enum"] | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_scrape_jobs: {
        Args: { p_batch_size?: number }
        Returns: {
          attempts: number
          id: string
          max_attempts: number
          payload: Json
          source_id: string
        }[]
      }
      claim_staging_rows: {
        Args: { p_batch_size?: number }
        Returns: {
          id: string
          parsing_method: string
          raw_html: string
          raw_payload: Json
          source_id: string
          source_url: string
          status: string
        }[]
      }
      cleanup_old_error_logs: { Args: never; Returns: number }
      complete_ai_job: {
        Args: { p_job_id: string; p_result: Json }
        Returns: undefined
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      enqueue_scrape_jobs: {
        Args: { p_jobs: Json }
        Returns: {
          out_job_id: string
          out_source_id: string
        }[]
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      fail_ai_job: {
        Args: { p_error: string; p_is_rate_limited?: boolean; p_job_id: string }
        Returns: undefined
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_discovery_rails: {
        Args: {
          p_limit_per_rail?: number
          p_radius_km?: number
          p_user_id: string
          p_user_lat: number
          p_user_long: number
        }
        Returns: Json
      }
      get_discovery_rails_v2: {
        Args: {
          p_limit_per_rail?: number
          p_radius_km?: number
          p_user_id: string
          p_user_lat: number
          p_user_long: number
        }
        Returns: Json
      }
      get_effective_rate_limit: {
        Args: { p_source_id: string }
        Returns: {
          delay_between_requests_ms: number
          max_concurrent: number
          requests_per_minute: number
        }[]
      }
      get_events_needing_geocoding: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          title: string
          venue_name: string
        }[]
      }
      get_friends_pulse: { Args: { current_user_id: string }; Returns: Json }
      get_mission_mode_events: {
        Args: {
          p_intent: string
          p_limit?: number
          p_max_distance_km?: number
          p_user_lat: number
          p_user_long: number
        }
        Returns: Json
      }
      get_nearby_events: {
        Args: {
          filter_category?: string[]
          filter_type?: string[]
          limit_count?: number
          offset_count?: number
          radius_km?: number
          user_lat: number
          user_long: number
        }
        Returns: {
          attendee_count: number
          category: string
          created_at: string
          created_by: string
          description: string
          distance_km: number
          event_date: string
          event_time: string
          event_type: string
          id: string
          image_url: string
          location: unknown
          match_percentage: number
          parent_event_id: string
          status: string
          title: string
          venue_name: string
        }[]
      }
      get_next_opening_time: {
        Args: { p_from_time?: string; p_opening_hours: Json }
        Returns: Json
      }
      get_personalized_feed: {
        Args: {
          limit_count?: number
          offset_count?: number
          user_id: string
          user_lat: number
          user_long: number
        }
        Returns: {
          attendee_count: number
          category: string
          description: string
          distance_km: number
          event_date: string
          event_id: string
          event_time: string
          event_type: string
          final_score: number
          host_reliability: number
          image_url: string
          location: Json
          match_percentage: number
          parent_event_id: string
          status: string
          title: string
          venue_name: string
        }[]
      }
      get_pipeline_health: {
        Args: never
        Returns: {
          avg_processing_seconds: number
          completed_count: number
          failed_count: number
          pending_count: number
          processing_count: number
          stuck_count: number
        }[]
      }
      get_recent_scraper_runs: {
        Args: { p_limit?: number; p_strategy?: string }
        Returns: {
          completed_at: string
          error_message: string
          events_failed: number
          events_scraped: number
          events_skipped: number
          id: string
          status: string
          strategy: string
        }[]
      }
      get_scraper_stats: {
        Args: { p_days?: number; p_strategy?: string }
        Returns: {
          failed_runs: number
          strategy: string
          success_rate: number
          successful_runs: number
          total_events_failed: number
          total_events_scraped: number
          total_events_skipped: number
          total_runs: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increase_source_rate_limit: {
        Args: {
          p_remaining?: number
          p_reset_ts?: string
          p_retry_after_seconds?: number
          p_source_id: string
          p_status_code: number
        }
        Returns: undefined
      }
      increment_savings_counter: {
        Args: { p_source_id: string }
        Returns: undefined
      }
      invoke_edge_function:
        | {
            Args: { p_function_name: string; p_payload?: Json }
            Returns: undefined
          }
        | {
            Args: {
              p_function_name: string
              p_payload?: Json
              p_timeout_seconds?: number
            }
            Returns: undefined
          }
      is_venue_open_now: {
        Args: { p_check_time?: string; p_opening_hours: Json }
        Returns: boolean
      }
      join_event_atomic: {
        Args: { p_event_id: string; p_profile_id: string; p_status?: string }
        Returns: Json
      }
      log_scraper_insight: {
        Args: {
          p_detected_cms?: string
          p_detected_framework?: string
          p_error_message?: string
          p_execution_time_ms?: number
          p_fetch_time_ms?: number
          p_has_hydration_data?: boolean
          p_has_ics_feed?: boolean
          p_has_json_ld?: boolean
          p_has_rss_feed?: boolean
          p_html_size_bytes?: number
          p_parse_time_ms?: number
          p_run_id?: string
          p_source_id: string
          p_status: string
          p_strategy_trace: Json
          p_total_events_found: number
          p_winning_strategy: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      match_events: {
        Args: {
          filter_category?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          description: string
          event_date: string
          event_id: string
          event_time: string
          event_type: string
          image_url: string
          similarity: number
          title: string
          venue_name: string
        }[]
      }
      poll_net_http_responses_audit: {
        Args: { p_since?: unknown }
        Returns: number
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      reprocess_low_quality_events: { Args: never; Returns: Json }
      reset_stale_processing_rows: {
        Args: never
        Returns: {
          reset_count: number
          row_ids: string[]
        }[]
      }
      reset_stuck_discovery_jobs: { Args: never; Returns: undefined }
      reset_stuck_scrape_jobs: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trigger_re_scout: { Args: { p_source_id: string }; Returns: undefined }
      trigger_scrape_coordinator: { Args: never; Returns: undefined }
      unlockrows: { Args: { "": string }; Returns: number }
      update_scraper_source_stats:
        | {
            Args: {
              p_events_scraped: number
              p_source_id: string
              p_success: boolean
            }
            Returns: undefined
          }
        | {
            Args: {
              p_events_scraped: number
              p_last_error?: string
              p_source_id: string
              p_success: boolean
            }
            Returns: undefined
          }
      update_source_health: {
        Args: { p_delta: number; p_reason?: string; p_source_id: string }
        Returns: number
      }
      update_source_preferred_method: {
        Args: { p_preferred_method: string; p_source_id: string }
        Returns: boolean
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      ai_job_status_enum:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "rate_limited"
      ai_job_type_enum:
        | "analyze_js_heavy"
        | "enrich_social_five"
        | "heal_selectors"
        | "classify_vibe"
      circuit_state_enum: "CLOSED" | "OPEN" | "HALF_OPEN"
      fetcher_type_enum: "static" | "puppeteer" | "playwright" | "scrapingbee"
      interaction_mode_enum: "HIGH" | "MEDIUM" | "LOW" | "PASSIVE"
      language_profile_enum: "NL" | "EN" | "DE" | "MIXED"
      nl_tier_enum: "tier1_g4" | "tier2_centrum" | "tier3_village"
      pipeline_status_enum:
        | "awaiting_fetch"
        | "awaiting_enrichment"
        | "processing"
        | "completed"
        | "failed"
        | "quarantined"
      raw_event_status: "pending" | "processing" | "completed" | "failed"
      time_mode: "fixed" | "window" | "anytime"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_job_status_enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "rate_limited",
      ],
      ai_job_type_enum: [
        "analyze_js_heavy",
        "enrich_social_five",
        "heal_selectors",
        "classify_vibe",
      ],
      circuit_state_enum: ["CLOSED", "OPEN", "HALF_OPEN"],
      fetcher_type_enum: ["static", "puppeteer", "playwright", "scrapingbee"],
      interaction_mode_enum: ["HIGH", "MEDIUM", "LOW", "PASSIVE"],
      language_profile_enum: ["NL", "EN", "DE", "MIXED"],
      nl_tier_enum: ["tier1_g4", "tier2_centrum", "tier3_village"],
      pipeline_status_enum: [
        "awaiting_fetch",
        "awaiting_enrichment",
        "processing",
        "completed",
        "failed",
        "quarantined",
      ],
      raw_event_status: ["pending", "processing", "completed", "failed"],
      time_mode: ["fixed", "window", "anytime"],
    },
  },
} as const
