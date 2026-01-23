export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      app_secrets: {
        Row: {
          created_at: string | null;
          key: string;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          key: string;
          value: string;
        };
        Update: {
          created_at?: string | null;
          key?: string;
          value?: string;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          admin1_code: string | null;
          continent: string | null;
          country_code: string;
          created_at: string | null;
          discovery_status: string | null;
          geoname_id: number | null;
          id: string;
          last_discovery_at: string | null;
          latitude: number | null;
          longitude: number | null;
          name: string;
          population: number | null;
          priority_tier: number | null;
          timezone: string | null;
        };
        Insert: {
          admin1_code?: string | null;
          continent?: string | null;
          country_code: string;
          created_at?: string | null;
          discovery_status?: string | null;
          geoname_id?: number | null;
          id?: string;
          last_discovery_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          population?: number | null;
          priority_tier?: number | null;
          timezone?: string | null;
        };
        Update: {
          admin1_code?: string | null;
          continent?: string | null;
          country_code?: string;
          created_at?: string | null;
          discovery_status?: string | null;
          geoname_id?: number | null;
          id?: string;
          last_discovery_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          population?: number | null;
          priority_tier?: number | null;
          timezone?: string | null;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          admin_notes: string | null;
          created_at: string;
          event_id: string | null;
          id: string;
          reason: string;
          reported_user_id: string | null;
          reporter_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          reason: string;
          reported_user_id?: string | null;
          reporter_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          reason?: string;
          reported_user_id?: string | null;
          reporter_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_reports_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_jobs: {
        Row: {
          attempts: number | null;
          batch_id: string | null;
          completed_at: string | null;
          coordinates: Json | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          max_attempts: number | null;
          municipality: string;
          population: number | null;
          priority: number | null;
          province: string | null;
          sources_added: number | null;
          sources_found: number | null;
          started_at: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          attempts?: number | null;
          batch_id?: string | null;
          completed_at?: string | null;
          coordinates?: Json | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          max_attempts?: number | null;
          municipality: string;
          population?: number | null;
          priority?: number | null;
          province?: string | null;
          sources_added?: number | null;
          sources_found?: number | null;
          started_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          attempts?: number | null;
          batch_id?: string | null;
          completed_at?: string | null;
          coordinates?: Json | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          max_attempts?: number | null;
          municipality?: string;
          population?: number | null;
          priority?: number | null;
          province?: string | null;
          sources_added?: number | null;
          sources_found?: number | null;
          started_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      error_logs: {
        Row: {
          context: Json | null;
          created_at: string;
          error_code: string | null;
          error_type: string | null;
          function_name: string | null;
          id: string;
          level: string;
          message: string;
          request_id: string | null;
          resolved: boolean | null;
          resolved_at: string | null;
          source: string;
          stack_trace: string | null;
          timestamp: string;
          user_agent: string | null;
        };
        Insert: {
          context?: Json | null;
          created_at?: string;
          error_code?: string | null;
          error_type?: string | null;
          function_name?: string | null;
          id?: string;
          level?: string;
          message: string;
          request_id?: string | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          source: string;
          stack_trace?: string | null;
          timestamp?: string;
          user_agent?: string | null;
        };
        Update: {
          context?: Json | null;
          created_at?: string;
          error_code?: string | null;
          error_type?: string | null;
          function_name?: string | null;
          id?: string;
          level?: string;
          message?: string;
          request_id?: string | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          source: string;
          stack_trace?: string | null;
          timestamp?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      event_attendees: {
        Row: {
          checked_in: boolean | null;
          event_id: string;
          id: string;
          joined_at: string | null;
          profile_id: string;
          status: string | null;
          ticket_number: string | null;
        };
        Insert: {
          checked_in?: boolean | null;
          event_id: string;
          id?: string;
          joined_at?: string | null;
          profile_id: string;
          status?: string | null;
          ticket_number?: string | null;
        };
        Update: {
          checked_in?: boolean | null;
          event_id?: string;
          id?: string;
          joined_at?: string | null;
          profile_id?: string;
          status?: string | null;
          ticket_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_invites: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          invited_by: string;
          invited_user_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          invited_by: string;
          invited_user_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          invited_by?: string;
          invited_user_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_invites_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_invites_invited_user_id_fkey";
            columns: ["invited_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          category: string;
          content_hash: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          embedding: string | null;
          embedding_generated_at: string | null;
          embedding_model: string | null;
          embedding_version: number | null;
          event_date: string;
          event_fingerprint: string | null;
          event_time: string;
          event_type: string;
          google_place_id: string | null;
          id: string;
          image_url: string | null;
          is_private: boolean;
          location: unknown;
          match_percentage: number | null;
          max_attendees: number | null;
          parent_event_id: string | null;
          persona_tags: string[] | null;
          source_id: string | null;
          source_url: string | null;
          status: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
          venue_name: string;
        };
        Insert: {
          category: string;
          content_hash?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          embedding_model?: string | null;
          embedding_version?: number | null;
          event_date: string;
          event_fingerprint?: string | null;
          event_time: string;
          event_type: string;
          google_place_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_private?: boolean;
          location: unknown;
          match_percentage?: number | null;
          max_attendees?: number | null;
          parent_event_id?: string | null;
          persona_tags?: string[] | null;
          source_id?: string | null;
          source_url?: string | null;
          status?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
          venue_name: string;
        };
        Update: {
          category?: string;
          content_hash?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          embedding_model?: string | null;
          embedding_version?: number | null;
          event_date?: string;
          event_fingerprint?: string | null;
          event_time?: string;
          event_type?: string;
          google_place_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_private?: boolean;
          location?: unknown;
          match_percentage?: number | null;
          max_attendees?: number | null;
          parent_event_id?: string | null;
          persona_tags?: string[] | null;
          source_id?: string | null;
          source_url?: string | null;
          status?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
          venue_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_parent_event_id_fkey";
            columns: ["parent_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "scraper_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "source_health_with_insights";
            referencedColumns: ["id"];
          },
        ];
      };
      geocode_cache: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          id: string;
          lat: number;
          lng: number;
          venue_key: string;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          lat: number;
          lng: number;
          venue_key: string;
        };
        Update: {
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          lat?: number;
          lng?: number;
          venue_key?: string;
        };
        Relationships: [];
      };
      google_calendar_tokens: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string | null;
          token_expiry: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          access_token: string;
          refresh_token?: string | null;
          token_expiry: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          access_token?: string;
          refresh_token?: string | null;
          token_expiry?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      google_calendar_events: {
        Row: {
          id: string;
          user_id: string;
          google_event_id: string;
          created_at: string;
          updated_at: string;
          status: string;
          last_synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_event_id: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
          last_synced_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_event_id?: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
          last_synced_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      net_http_responses_audit: {
        Row: {
          body: Json | null;
          completed_at: string | null;
          created_at: string | null;
          duration_ms: number | null;
          headers: Json | null;
          id: number;
          method: string | null;
          request_id: string | null;
          started_at: string | null;
          status: number | null;
          url: string | null;
        };
        Insert: {
          body?: Json | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_ms?: number | null;
          headers?: Json | null;
          id?: number;
          method?: string | null;
          request_id?: string | null;
          started_at?: string | null;
          status?: number | null;
          url?: string | null;
        };
        Update: {
          body?: Json | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_ms?: number | null;
          headers?: Json | null;
          id?: number;
          method?: string | null;
          request_id?: string | null;
          started_at?: string | null;
          status?: number | null;
          url?: string | null;
        };
        Relationships: [];
      };
      persona_badges: {
        Row: {
          badge_icon: string;
          badge_level: string;
          badge_name: string;
          earned_at: string | null;
          id: string;
          persona_type: string;
          profile_id: string;
        };
        Insert: {
          badge_icon: string;
          badge_level: string;
          badge_name: string;
          earned_at?: string | null;
          id?: string;
          persona_type: string;
          profile_id: string;
        };
        Update: {
          badge_icon?: string;
          badge_level?: string;
          badge_name?: string;
          earned_at?: string | null;
          id?: string;
          persona_type?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "persona_badges_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      persona_stats: {
        Row: {
          created_at: string | null;
          host_rating: number | null;
          id: string;
          newcomers_welcomed: number | null;
          persona_type: string;
          profile_id: string;
          rallies_hosted: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          host_rating?: number | null;
          id?: string;
          newcomers_welcomed?: number | null;
          persona_type: string;
          profile_id: string;
          rallies_hosted?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          host_rating?: number | null;
          id?: string;
          newcomers_welcomed?: number | null;
          persona_type?: string;
          profile_id?: string;
          rallies_hosted?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "persona_stats_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          current_persona: string | null;
          events_attended: number | null;
          events_committed: number | null;
          full_name: string;
          id: string;
          location_city: string | null;
          location_coordinates: unknown;
          location_country: string | null;
          profile_complete: boolean | null;
          reliability_score: number | null;
          updated_at: string | null;
          user_id: string | null;
          verified_resident: boolean | null;
          interest_scores: Json | null;
          is_parent_detected: boolean | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          current_persona?: string | null;
          events_attended?: number | null;
          events_committed?: number | null;
          full_name: string;
          id?: string;
          location_city?: string | null;
          location_coordinates?: unknown;
          location_country?: string | null;
          profile_complete?: boolean | null;
          reliability_score?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
          verified_resident?: boolean | null;
          interest_scores?: Json | null;
          is_parent_detected?: boolean | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          current_persona?: string | null;
          events_attended?: number | null;
          events_committed?: number | null;
          full_name?: string;
          id?: string;
          location_city?: string | null;
          location_coordinates?: unknown;
          location_country?: string | null;
          profile_complete?: boolean | null;
          reliability_score?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
          verified_resident?: boolean | null;
          interest_scores?: Json | null;
          is_parent_detected?: boolean | null;
        };
        Relationships: [];
      };
      proposals: {
        Row: {
          created_at: string;
          creator_id: string;
          event_id: string;
          id: string;
          proposed_times: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          event_id: string;
          id?: string;
          proposed_times: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          event_id?: string;
          id?: string;
          proposed_times?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      raw_event_staging: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          id: string;
          last_health_check: string | null;
          parsing_method: string | null;
          processing_log: Json | null;
          processing_started_at: string | null;
          raw_html: string;
          retry_count: number | null;
          source_id: string | null;
          source_url: string;
          status: Database["public"]["Enums"]["raw_event_status"] | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          last_health_check?: string | null;
          parsing_method?: string | null;
          processing_log?: Json | null;
          processing_started_at?: string | null;
          raw_html: string;
          retry_count?: number | null;
          source_id?: string | null;
          source_url: string;
          status?: Database["public"]["Enums"]["raw_event_status"] | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          last_health_check?: string | null;
          parsing_method?: string | null;
          processing_log?: Json | null;
          processing_started_at?: string | null;
          raw_html?: string;
          retry_count?: number | null;
          source_id?: string | null;
          source_url?: string;
          status?: Database["public"]["Enums"]["raw_event_status"] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "raw_event_staging_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "scraper_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "raw_event_staging_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "source_health_with_insights";
            referencedColumns: ["id"];
          },
        ];
      };
      scrape_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          events_inserted: number;
          events_scraped: number;
          id: string;
          source_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          events_inserted?: number;
          events_scraped?: number;
          id?: string;
          source_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          events_inserted?: number;
          events_scraped?: number;
          id?: string;
          source_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "scraper_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      scraper_sources: {
        Row: {
          auto_disabled: boolean | null;
          city: string;
          config: Json | null;
          consecutive_failures: number | null;
          content_selector: string | null;
          created_at: string | null;
          description: string | null;
          dynamic_rendering: boolean | null;
          enabled: boolean;
          event_card_selector: string | null;
          fetcher_type: Database["public"]["Enums"]["fetcher_type_enum"] | null;
          id: string;
          is_active: boolean;
          last_error: string | null;
          last_run_at: string | null;
          last_scraped_at: string | null;
          last_success: boolean | null;
          name: string;
          pagination_type: string | null;
          scraping_schedule: string | null;
          status: string | null;
          total_events_scraped: number | null;
          updated_at: string | null;
          url: string;
          wait_time: number | null;
        };
        Insert: {
          auto_disabled?: boolean | null;
          city: string;
          config?: Json | null;
          consecutive_failures?: number | null;
          content_selector?: string | null;
          created_at?: string | null;
          description?: string | null;
          dynamic_rendering?: boolean | null;
          enabled?: boolean;
          event_card_selector?: string | null;
          fetcher_type?:
            | Database["public"]["Enums"]["fetcher_type_enum"]
            | null;
          id?: string;
          is_active?: boolean;
          last_error?: string | null;
          last_run_at?: string | null;
          last_scraped_at?: string | null;
          last_success?: boolean | null;
          name: string;
          pagination_type?: string | null;
          scraping_schedule?: string | null;
          status?: string | null;
          total_events_scraped?: number | null;
          updated_at?: string | null;
          url: string;
          wait_time?: number | null;
        };
        Update: {
          auto_disabled?: boolean | null;
          city?: string;
          config?: Json | null;
          consecutive_failures?: number | null;
          content_selector?: string | null;
          created_at?: string | null;
          description?: string | null;
          dynamic_rendering?: boolean | null;
          enabled?: boolean;
          event_card_selector?: string | null;
          fetcher_type?:
            | Database["public"]["Enums"]["fetcher_type_enum"]
            | null;
          id?: string;
          is_active?: boolean;
          last_error?: string | null;
          last_run_at?: string | null;
          last_scraped_at?: string | null;
          last_success?: boolean | null;
          name?: string;
          pagination_type?: string | null;
          scraping_schedule?: string | null;
          status?: string | null;
          total_events_scraped?: number | null;
          updated_at?: string | null;
          url?: string;
          wait_time?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      source_health_with_insights: {
        Row: {
          avg_processing_time_seconds: number | null;
          avg_response_time_ms: number | null;
          city: string | null;
          days_since_last_event: number | null;
          failed_events_last_30d: number | null;
          id: string | null;
          last_error_message: string | null;
          last_success_at: string | null;
          name: string | null;
          pending_count: number | null;
          status: string | null;
          success_rate: number | null;
          total_events: number | null;
          url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_event_attendance: {
        Args: {
          p_event_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      get_discovery_rails: {
        Args: {
          p_user_id: string;
          p_user_lat: number;
          p_user_long: number;
          p_radius_km: number;
          p_limit_per_rail?: number;
        };
        Returns: {
          rail_title: string;
          rail_type: string;
          events: Json;
        }[];
      };
      get_friends_pulse: {
        Args: {
          current_user_id: string;
        };
        Returns: {
          event_id: string;
          friend_count: number;
          friends: Json;
        }[];
      };
      get_mission_mode_events: {
        Args: {
          p_intent: string;
          p_user_lat: number;
          p_user_long: number;
          p_max_distance_km: number;
          p_limit?: number;
        };
        Returns: {
          id: string;
          title: string;
          description: string;
          category: string;
          event_type: string;
          venue_name: string;
          location: unknown;
          event_date: string;
          event_time: string;
          status: string;
          image_url: string;
          match_percentage: number;
          attendee_count: number;
          created_by: string;
          created_at: string;
          parent_event_id: string;
          distance_km: number;
        }[];
      };
      get_nearby_events: {
        Args: {
          user_lat: number;
          user_long: number;
          radius_km: number;
          limit_count?: number;
          offset_count?: number;
          filter_category?: string;
          filter_type?: string;
        };
        Returns: {
          id: string;
          title: string;
          description: string;
          category: string;
          event_type: string;
          venue_name: string;
          location: unknown;
          event_date: string;
          event_time: string;
          status: string;
          image_url: string;
          match_percentage: number;
          attendee_count: number;
          created_by: string;
          created_at: string;
          parent_event_id: string;
          distance_km: number;
        }[];
      };
      join_event_atomic: {
        Args: {
          p_event_id: string;
          p_profile_id: string;
          p_status: string;
        };
        Returns: {
          status: "ok" | "exists" | "full" | "error";
          message?: string;
          event_id?: string;
          profile_id?: string;
        };
      };
    };
    Enums: {
      fetcher_type_enum: "static" | "puppeteer" | "playwright" | "scrapingbee";
      raw_event_status: "pending" | "processing" | "completed" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
