Initialising login role...
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
          end_datetime: string | null
          end_time: string | null
          enrichment_attempted_at: string | null
          event_date: string | null
          event_time: string
          event_type: string
          google_place_id: string | null
          id: string
          image_url: string | null
          interaction_mode: string | null
          is_all_day: boolean | null
          is_multi_day: boolean | null
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
          social_five_score: number | null
          social_links: Json | null
          source_url: string | null
          start_datetime: string | null
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
          end_datetime?: string | null
          end_time?: string | null
          enrichment_attempted_at?: string | null
          event_date?: string | null
          event_time: string
          event_type: string
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          interaction_mode?: string | null
          is_all_day?: boolean | null
          is_multi_day?: boolean | null
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
          social_five_score?: number | null
          social_links?: Json | null
          source_url?: string | null
          start_datetime?: string | null
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
          end_datetime?: string | null
          end_time?: string | null
          enrichment_attempted_at?: string | null
          event_date?: string | null
          event_time?: string
          event_type?: string
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          interaction_mode?: string | null
          is_all_day?: boolean | null
          is_multi_day?: boolean | null
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
          social_five_score?: number | null
          social_links?: Json | null
          source_url?: string | null
          start_datetime?: string | null
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
        Relationships: []
      }
      sg_ai_repair_log: {
        Row: {
          ai_diagnosis: string | null
          applied: boolean | null
          applied_at: string | null
          created_at: string | null
          id: string
          new_config: Json | null
          old_config: Json | null
          raw_html_sample: string | null
          rollback_available: boolean | null
          source_id: string | null
          trigger_reason: string
          validation_passed: boolean | null
          validation_sample_size: number | null
          validation_success_rate: number | null
        }
        Insert: {
          ai_diagnosis?: string | null
          applied?: boolean | null
          applied_at?: string | null
          created_at?: string | null
          id?: string
          new_config?: Json | null
          old_config?: Json | null
          raw_html_sample?: string | null
          rollback_available?: boolean | null
          source_id?: string | null
          trigger_reason: string
          validation_passed?: boolean | null
          validation_sample_size?: number | null
          validation_success_rate?: number | null
        }
        Update: {
          ai_diagnosis?: string | null
          applied?: boolean | null
          applied_at?: string | null
          created_at?: string | null
          id?: string
          new_config?: Json | null
          old_config?: Json | null
          raw_html_sample?: string | null
          rollback_available?: boolean | null
          source_id?: string | null
          trigger_reason?: string
          validation_passed?: boolean | null
          validation_sample_size?: number | null
          validation_success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sg_ai_repair_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sg_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sg_failure_log: {
        Row: {
          ai_response: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          failure_level: Database["public"]["Enums"]["failure_level"]
          http_status: number | null
          id: string
          queue_item_id: string | null
          raw_input: string | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number | null
          source_id: string | null
          stack_trace: string | null
          stage: Database["public"]["Enums"]["sg_pipeline_stage"]
        }
        Insert: {
          ai_response?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failure_level: Database["public"]["Enums"]["failure_level"]
          http_status?: number | null
          id?: string
          queue_item_id?: string | null
          raw_input?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          source_id?: string | null
          stack_trace?: string | null
          stage: Database["public"]["Enums"]["sg_pipeline_stage"]
        }
        Update: {
          ai_response?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failure_level?: Database["public"]["Enums"]["failure_level"]
          http_status?: number | null
          id?: string
          queue_item_id?: string | null
          raw_input?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          source_id?: string | null
          stack_trace?: string | null
          stage?: Database["public"]["Enums"]["sg_pipeline_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "sg_failure_log_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "sg_pipeline_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sg_failure_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sg_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sg_geocode_cache: {
        Row: {
          address_key: string
          created_at: string | null
          display_name: string | null
          expires_at: string | null
          hit_count: number | null
          id: string
          importance: number | null
          last_hit_at: string | null
          lat: number
          lng: number
          original_query: string
          place_type: string | null
          raw_response: Json | null
        }
        Insert: {
          address_key: string
          created_at?: string | null
          display_name?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          importance?: number | null
          last_hit_at?: string | null
          lat: number
          lng: number
          original_query: string
          place_type?: string | null
          raw_response?: Json | null
        }
        Update: {
          address_key?: string
          created_at?: string | null
          display_name?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          importance?: number | null
          last_hit_at?: string | null
          lat?: number
          lng?: number
          original_query?: string
          place_type?: string | null
          raw_response?: Json | null
        }
        Relationships: []
      }
      sg_pipeline_metrics: {
        Row: {
          avg_duration_ms: number | null
          bucket_end: string
          bucket_start: string
          estimated_cost_usd: number | null
          id: string
          items_failed: number | null
          items_processed: number | null
          items_skipped: number | null
          p50_duration_ms: number | null
          p95_duration_ms: number | null
          p99_duration_ms: number | null
          stage: Database["public"]["Enums"]["sg_pipeline_stage"]
          total_ai_tokens: number | null
          total_api_calls: number | null
        }
        Insert: {
          avg_duration_ms?: number | null
          bucket_end: string
          bucket_start: string
          estimated_cost_usd?: number | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_skipped?: number | null
          p50_duration_ms?: number | null
          p95_duration_ms?: number | null
          p99_duration_ms?: number | null
          stage: Database["public"]["Enums"]["sg_pipeline_stage"]
          total_ai_tokens?: number | null
          total_api_calls?: number | null
        }
        Update: {
          avg_duration_ms?: number | null
          bucket_end?: string
          bucket_start?: string
          estimated_cost_usd?: number | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_skipped?: number | null
          p50_duration_ms?: number | null
          p95_duration_ms?: number | null
          p99_duration_ms?: number | null
          stage?: Database["public"]["Enums"]["sg_pipeline_stage"]
          total_ai_tokens?: number | null
          total_api_calls?: number | null
        }
        Relationships: []
      }
      sg_pipeline_queue: {
        Row: {
          analyzed_at: string | null
          claimed_at: string | null
          cleaned_markdown: string | null
          content_hash: string | null
          created_at: string | null
          detail_url: string | null
          discovered_at: string | null
          discovery_method:
            | Database["public"]["Enums"]["discovery_method"]
            | null
          duplicate_of: string | null
          embedding: string | null
          enriched_at: string | null
          event_id: string | null
          extracted_at: string | null
          extracted_data: Json | null
          failure_count: number | null
          failure_level: Database["public"]["Enums"]["failure_level"] | null
          fetched_at: string | null
          geocode_attempts: number | null
          geocode_raw_response: Json | null
          geocode_status: string | null
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          lat: number | null
          lng: number | null
          persisted_at: string | null
          priority: number | null
          raw_html: string | null
          source_id: string | null
          source_url: string
          stage: Database["public"]["Enums"]["sg_pipeline_stage"] | null
          updated_at: string | null
          validated_at: string | null
          vectorized_at: string | null
          worker_id: string | null
        }
        Insert: {
          analyzed_at?: string | null
          claimed_at?: string | null
          cleaned_markdown?: string | null
          content_hash?: string | null
          created_at?: string | null
          detail_url?: string | null
          discovered_at?: string | null
          discovery_method?:
            | Database["public"]["Enums"]["discovery_method"]
            | null
          duplicate_of?: string | null
          embedding?: string | null
          enriched_at?: string | null
          event_id?: string | null
          extracted_at?: string | null
          extracted_data?: Json | null
          failure_count?: number | null
          failure_level?: Database["public"]["Enums"]["failure_level"] | null
          fetched_at?: string | null
          geocode_attempts?: number | null
          geocode_raw_response?: Json | null
          geocode_status?: string | null
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          lat?: number | null
          lng?: number | null
          persisted_at?: string | null
          priority?: number | null
          raw_html?: string | null
          source_id?: string | null
          source_url: string
          stage?: Database["public"]["Enums"]["sg_pipeline_stage"] | null
          updated_at?: string | null
          validated_at?: string | null
          vectorized_at?: string | null
          worker_id?: string | null
        }
        Update: {
          analyzed_at?: string | null
          claimed_at?: string | null
          cleaned_markdown?: string | null
          content_hash?: string | null
          created_at?: string | null
          detail_url?: string | null
          discovered_at?: string | null
          discovery_method?:
            | Database["public"]["Enums"]["discovery_method"]
            | null
          duplicate_of?: string | null
          embedding?: string | null
          enriched_at?: string | null
          event_id?: string | null
          extracted_at?: string | null
          extracted_data?: Json | null
          failure_count?: number | null
          failure_level?: Database["public"]["Enums"]["failure_level"] | null
          fetched_at?: string | null
          geocode_attempts?: number | null
          geocode_raw_response?: Json | null
          geocode_status?: string | null
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          lat?: number | null
          lng?: number | null
          persisted_at?: string | null
          priority?: number | null
          raw_html?: string | null
          source_id?: string | null
          source_url?: string
          stage?: Database["public"]["Enums"]["sg_pipeline_stage"] | null
          updated_at?: string | null
          validated_at?: string | null
          vectorized_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sg_pipeline_queue_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "sg_pipeline_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sg_pipeline_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sg_pipeline_queue_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sg_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sg_serper_queries: {
        Row: {
          category: string | null
          city: string | null
          credits_used: number | null
          error_message: string | null
          executed_at: string | null
          id: string
          query_text: string
          response_time_ms: number | null
          result_count: number | null
          sources_created: number | null
          success: boolean | null
          template: string | null
          urls_discovered: string[] | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          credits_used?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          query_text: string
          response_time_ms?: number | null
          result_count?: number | null
          sources_created?: number | null
          success?: boolean | null
          template?: string | null
          urls_discovered?: string[] | null
        }
        Update: {
          category?: string | null
          city?: string | null
          credits_used?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          query_text?: string
          response_time_ms?: number | null
          result_count?: number | null
          sources_created?: number | null
          success?: boolean | null
          template?: string | null
          urls_discovered?: string[] | null
        }
        Relationships: []
      }
      sg_sources: {
        Row: {
          city: string | null
          config_version: number | null
          consecutive_failures: number | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          discovery_method: Database["public"]["Enums"]["discovery_method"]
          domain: string | null
          enabled: boolean | null
          extraction_config: Json | null
          fetch_strategy: Json | null
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          last_successful_scrape: string | null
          name: string
          quarantine_reason: string | null
          quarantined: boolean | null
          quarantined_at: string | null
          rate_limit_state: Json | null
          reliability_score: number | null
          schema_version: string | null
          serper_discovered_at: string | null
          serper_query: string | null
          tier: Database["public"]["Enums"]["source_tier"]
          total_events_extracted: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          city?: string | null
          config_version?: number | null
          consecutive_failures?: number | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          discovery_method?: Database["public"]["Enums"]["discovery_method"]
          domain?: string | null
          enabled?: boolean | null
          extraction_config?: Json | null
          fetch_strategy?: Json | null
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_successful_scrape?: string | null
          name: string
          quarantine_reason?: string | null
          quarantined?: boolean | null
          quarantined_at?: string | null
          rate_limit_state?: Json | null
          reliability_score?: number | null
          schema_version?: string | null
          serper_discovered_at?: string | null
          serper_query?: string | null
          tier?: Database["public"]["Enums"]["source_tier"]
          total_events_extracted?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          city?: string | null
          config_version?: number | null
          consecutive_failures?: number | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          discovery_method?: Database["public"]["Enums"]["discovery_method"]
          domain?: string | null
          enabled?: boolean | null
          extraction_config?: Json | null
          fetch_strategy?: Json | null
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_successful_scrape?: string | null
          name?: string
          quarantine_reason?: string | null
          quarantined?: boolean | null
          quarantined_at?: string | null
          rate_limit_state?: Json | null
          reliability_score?: number | null
          schema_version?: string | null
          serper_discovered_at?: string | null
          serper_query?: string | null
          tier?: Database["public"]["Enums"]["source_tier"]
          total_events_extracted?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
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
      claim_for_enrichment: {
        Args: { p_worker_id?: string }
        Returns: {
          detail_url: string
          id: string
          raw_html: string
          source_id: string
          source_url: string
          title: string
        }[]
      }
      claim_for_indexing: {
        Args: { p_batch_size?: number }
        Returns: {
          category: string
          coordinates: unknown
          description: string
          event_date: string
          event_time: string
          id: string
          image_url: string
          price: string
          source_id: string
          source_url: string
          structured_data: Json
          tickets_url: string
          title: string
          venue_address: string
          venue_name: string
        }[]
      }
      claim_staging_rows: {
        Args: { p_batch_size?: number }
        Returns: {
          detail_html: string
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
      complete_enrichment: {
        Args: {
          p_category?: string
          p_description?: string
          p_event_date?: string
          p_event_time?: string
          p_id: string
          p_image_url?: string
          p_structured_data: Json
          p_title?: string
          p_venue_name?: string
        }
        Returns: undefined
      }
      complete_indexing: { Args: { p_ids: string[] }; Returns: undefined }
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
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      fail_ai_job: {
        Args: { p_error: string; p_is_rate_limited?: boolean; p_job_id: string }
        Returns: undefined
      }
      fail_enrichment: {
        Args: { p_error: string; p_id: string }
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
      sg_advance_stage: {
        Args: {
          p_extracted_data?: Json
          p_item_id: string
          p_lat?: number
          p_lng?: number
          p_next_stage: Database["public"]["Enums"]["sg_pipeline_stage"]
        }
        Returns: undefined
      }
      sg_claim_for_stage: {
        Args: {
          p_limit?: number
          p_stage: Database["public"]["Enums"]["sg_pipeline_stage"]
          p_worker_id?: string
        }
        Returns: {
          detail_url: string
          extracted_data: Json
          id: string
          priority: number
          raw_html: string
          source_id: string
          source_url: string
        }[]
      }
      sg_get_pipeline_stats: {
        Args: never
        Returns: {
          avg_wait_time_minutes: number
          count: number
          oldest_item: string
          stage: string
        }[]
      }
      sg_insert_geocode_cache: {
        Args: {
          p_city: string
          p_country: string
          p_display_name?: string
          p_lat: number
          p_lng: number
          p_postal: string
          p_raw_response?: Json
          p_street: string
          p_venue: string
        }
        Returns: undefined
      }
      sg_lookup_geocode_cache: {
        Args: {
          p_city: string
          p_country?: string
          p_postal: string
          p_street: string
          p_venue: string
        }
        Returns: {
          cached: boolean
          lat: number
          lng: number
        }[]
      }
      sg_normalize_address_key: {
        Args: {
          p_city: string
          p_country: string
          p_postal: string
          p_street: string
          p_venue: string
        }
        Returns: string
      }
      sg_record_failure: {
        Args: {
          p_error_code?: string
          p_error_message: string
          p_failure_level: Database["public"]["Enums"]["failure_level"]
          p_item_id: string
        }
        Returns: undefined
      }
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
      unlockrows: { Args: { "": string }; Returns: number }
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
      discovery_method:
        | "serper_search"
        | "api_webhook"
        | "seed_list"
        | "internal_link"
        | "sitemap"
      failure_level:
        | "transient"
        | "source_drift"
        | "repair_failure"
        | "systemic"
      interaction_mode_enum: "HIGH" | "MEDIUM" | "LOW" | "PASSIVE"
      language_profile_enum: "NL" | "EN" | "DE" | "MIXED"
      nl_tier_enum: "tier1_g4" | "tier2_centrum" | "tier3_village"
      pipeline_status:
        | "discovered"
        | "awaiting_enrichment"
        | "enriching"
        | "enriched"
        | "ready_to_index"
        | "indexing"
        | "processed"
        | "failed"
      pipeline_status_enum:
        | "awaiting_fetch"
        | "awaiting_enrichment"
        | "processing"
        | "completed"
        | "failed"
        | "quarantined"
      raw_event_status: "pending" | "processing" | "completed" | "failed"
      sg_pipeline_stage:
        | "discovered"
        | "analyzing"
        | "awaiting_fetch"
        | "fetching"
        | "cleaning"
        | "extracting"
        | "validating"
        | "enriching"
        | "deduplicating"
        | "ready_to_persist"
        | "vectorizing"
        | "indexed"
        | "geo_incomplete"
        | "quarantined"
        | "failed"
      source_tier: "tier_1_metropolis" | "tier_2_regional" | "tier_3_hyperlocal"
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
      discovery_method: [
        "serper_search",
        "api_webhook",
        "seed_list",
        "internal_link",
        "sitemap",
      ],
      failure_level: [
        "transient",
        "source_drift",
        "repair_failure",
        "systemic",
      ],
      interaction_mode_enum: ["HIGH", "MEDIUM", "LOW", "PASSIVE"],
      language_profile_enum: ["NL", "EN", "DE", "MIXED"],
      nl_tier_enum: ["tier1_g4", "tier2_centrum", "tier3_village"],
      pipeline_status: [
        "discovered",
        "awaiting_enrichment",
        "enriching",
        "enriched",
        "ready_to_index",
        "indexing",
        "processed",
        "failed",
      ],
      pipeline_status_enum: [
        "awaiting_fetch",
        "awaiting_enrichment",
        "processing",
        "completed",
        "failed",
        "quarantined",
      ],
      raw_event_status: ["pending", "processing", "completed", "failed"],
      sg_pipeline_stage: [
        "discovered",
        "analyzing",
        "awaiting_fetch",
        "fetching",
        "cleaning",
        "extracting",
        "validating",
        "enriching",
        "deduplicating",
        "ready_to_persist",
        "vectorizing",
        "indexed",
        "geo_incomplete",
        "quarantined",
        "failed",
      ],
      source_tier: [
        "tier_1_metropolis",
        "tier_2_regional",
        "tier_3_hyperlocal",
      ],
      time_mode: ["fixed", "window", "anytime"],
    },
  },
} as const
