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
          created_at: string | null;
          id: string;
          reason: string;
          reporter_id: string | null;
          status: string | null;
          target_event_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          reason: string;
          reporter_id?: string | null;
          status?: string | null;
          target_event_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string | null;
          status?: string | null;
          target_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_target_event_id_fkey";
            columns: ["target_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_jobs: {
        Row: {
          city_id: string | null;
          completed_at: string | null;
          id: string;
          results_count: number | null;
          source_id: string | null;
          started_at: string | null;
          status: string | null;
        };
        Insert: {
          city_id?: string | null;
          completed_at?: string | null;
          id?: string;
          results_count?: number | null;
          source_id?: string | null;
          started_at?: string | null;
          status?: string | null;
        };
        Update: {
          city_id?: string | null;
          completed_at?: string | null;
          id?: string;
          results_count?: number | null;
          source_id?: string | null;
          started_at?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_jobs_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_jobs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "scraper_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      enrichment_logs: {
        Row: {
          api_calls_used: number | null;
          created_at: string;
          data_enriched: Json | null;
          error_message: string | null;
          event_id: string | null;
          id: string;
          source: string | null;
          status: string;
        };
        Insert: {
          api_calls_used?: number | null;
          created_at?: string;
          data_enriched?: Json | null;
          error_message?: string | null;
          event_id?: string | null;
          id?: string;
          source?: string | null;
          status: string;
        };
        Update: {
          api_calls_used?: number | null;
          created_at?: string;
          data_enriched?: Json | null;
          error_message?: string | null;
          event_id?: string | null;
          id?: string;
          source?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrichment_logs_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      error_logs: {
        Row: {
          context: Json | null;
          created_at: string | null;
          id: string;
          message: string;
          severity: string | null;
          source: string | null;
          stack: string | null;
        };
        Insert: {
          context?: Json | null;
          created_at?: string | null;
          id?: string;
          message: string;
          severity?: string | null;
          source?: string | null;
          stack?: string | null;
        };
        Update: {
          context?: Json | null;
          created_at?: string | null;
          id?: string;
          message?: string;
          severity?: string | null;
          source?: string | null;
          stack?: string | null;
        };
        Relationships: [];
      };
      event_attendees: {
        Row: {
          event_id: string;
          id: string;
          joined_at: string | null;
          profile_id: string;
          status: string | null;
          ticket_number: string | null;
          updated_at: string | null;
        };
        Insert: {
          event_id: string;
          id?: string;
          joined_at?: string | null;
          profile_id: string;
          status?: string | null;
          ticket_number?: string | null;
          updated_at?: string | null;
        };
        Update: {
          event_id?: string;
          id?: string;
          joined_at?: string | null;
          profile_id?: string;
          status?: string | null;
          ticket_number?: string | null;
          updated_at?: string | null;
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
      event_bookmarks: {
        Row: {
          created_at: string | null;
          event_id: string | null;
          id: string;
          profile_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          event_id?: string | null;
          id?: string;
          profile_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          event_id?: string | null;
          id?: string;
          profile_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_bookmarks_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_bookmarks_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_invites: {
        Row: {
          created_at: string | null;
          event_id: string | null;
          id: string;
          invite_code: string | null;
          invited_email: string | null;
          inviter_id: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          event_id?: string | null;
          id?: string;
          invite_code?: string | null;
          invited_email?: string | null;
          inviter_id?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          event_id?: string | null;
          id?: string;
          invite_code?: string | null;
          invited_email?: string | null;
          inviter_id?: string | null;
          status?: string | null;
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
            foreignKeyName: "event_invites_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          address: string | null;
          attendee_limit: number | null;
          category: string;
          contact_phone: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          end_time: string | null;
          enrichment_attempted_at: string | null;
          event_date: string | null;
          event_time: string | null;
          event_type: string;
          google_place_id: string | null;
          id: string;
          image_url: string | null;
          is_private: boolean | null;
          location: string | null;
          max_attendees: number | null;
          opening_hours: Json | null;
          parent_event_id: string | null;
          price_range: string | null;
          social_links: Json | null;
          start_time: string | null;
          tags: string[] | null;
          ticket_url: string | null;
          time_mode: Database["public"]["Enums"]["time_mode"] | null;
          title: string;
          updated_at: string | null;
          venue_name: string | null;
          website_url: string | null;
        };
        Insert: {
          address?: string | null;
          attendee_limit?: number | null;
          category: string;
          contact_phone?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          end_time?: string | null;
          enrichment_attempted_at?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          event_type?: string;
          google_place_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_private?: boolean | null;
          location?: string | null;
          max_attendees?: number | null;
          opening_hours?: Json | null;
          parent_event_id?: string | null;
          price_range?: string | null;
          social_links?: Json | null;
          start_time?: string | null;
          tags?: string[] | null;
          ticket_url?: string | null;
          time_mode?: Database["public"]["Enums"]["time_mode"] | null;
          title: string;
          updated_at?: string | null;
          venue_name?: string | null;
          website_url?: string | null;
        };
        Update: {
          address?: string | null;
          attendee_limit?: number | null;
          category?: string;
          contact_phone?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          end_time?: string | null;
          enrichment_attempted_at?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          event_type?: string;
          google_place_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_private?: boolean | null;
          location?: string | null;
          max_attendees?: number | null;
          opening_hours?: Json | null;
          parent_event_id?: string | null;
          price_range?: string | null;
          social_links?: Json | null;
          start_time?: string | null;
          tags?: string[] | null;
          ticket_url?: string | null;
          time_mode?: Database["public"]["Enums"]["time_mode"] | null;
          title?: string;
          updated_at?: string | null;
          venue_name?: string | null;
          website_url?: string | null;
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
        ];
      };
      google_calendar_events: {
        Row: {
          created_at: string | null;
          event_id: string;
          google_event_id: string;
          id: string;
          profile_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          event_id: string;
          google_event_id: string;
          id?: string;
          profile_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          event_id?: string;
          google_event_id?: string;
          id?: string;
          profile_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "google_calendar_events_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      google_calendar_tokens: {
        Row: {
          access_token: string;
          calendar_id: string | null;
          created_at: string | null;
          id: string;
          profile_id: string;
          refresh_token: string | null;
          token_expiry: string;
          updated_at: string | null;
        };
        Insert: {
          access_token: string;
          calendar_id?: string | null;
          created_at?: string | null;
          id?: string;
          profile_id: string;
          refresh_token?: string | null;
          token_expiry: string;
          updated_at?: string | null;
        };
        Update: {
          access_token?: string;
          calendar_id?: string | null;
          created_at?: string | null;
          id?: string;
          profile_id?: string;
          refresh_token?: string | null;
          token_expiry?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      persona_badges: {
        Row: {
          category: string;
          created_at: string | null;
          id: string;
          image_url: string | null;
          name: string;
          persona_type: string;
          profile_id: string;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          persona_type: string;
          profile_id: string;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
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
          current_persona: string | null;
          events_attended: number | null;
          events_committed: number | null;
          full_name: string | null;
          id: string;
          location_city: string | null;
          location_coordinates: string | null;
          location_country: string | null;
          profile_complete: boolean | null;
          reliability_score: number | null;
          user_id: string | null;
          verified_resident: boolean | null;
        };
        Insert: {
          avatar_url?: string | null;
          current_persona?: string | null;
          events_attended?: number | null;
          events_committed?: number | null;
          full_name?: string | null;
          id?: string;
          location_city?: string | null;
          location_coordinates?: string | null;
          location_country?: string | null;
          profile_complete?: boolean | null;
          reliability_score?: number | null;
          user_id?: string | null;
          verified_resident?: boolean | null;
        };
        Update: {
          avatar_url?: string | null;
          current_persona?: string | null;
          events_attended?: number | null;
          events_committed?: number | null;
          full_name?: string | null;
          id?: string;
          location_city?: string | null;
          location_coordinates?: string | null;
          location_country?: string | null;
          profile_complete?: boolean | null;
          reliability_score?: number | null;
          user_id?: string | null;
          verified_resident?: boolean | null;
        };
        Relationships: [];
      };
      proposal_votes: {
        Row: {
          created_at: string;
          id: string;
          proposal_id: string;
          user_id: string;
          vote: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          proposal_id: string;
          user_id: string;
          vote: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          proposal_id?: string;
          user_id?: string;
          vote?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_votes_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposal_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          created_at: string;
          creator_id: string;
          description: string | null;
          event_id: string;
          id: string;
          proposed_time: string | null;
          proposed_times: Json;
          status: string;
          title: string | null;
          updated_at: string;
          venue_place_id: string | null;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          description?: string | null;
          event_id: string;
          id?: string;
          proposed_time?: string | null;
          proposed_times: Json;
          status?: string;
          title?: string | null;
          updated_at?: string;
          venue_place_id?: string | null;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          description?: string | null;
          event_id?: string;
          id?: string;
          proposed_time?: string | null;
          proposed_times?: Json;
          status?: string;
          title?: string | null;
          updated_at?: string;
          venue_place_id?: string | null;
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
      scraper_sources: {
        Row: {
          id: string;
          name: string;
          url: string;
          enabled: boolean;
          config: Json;
          last_scraped_at: string | null;
          total_events_scraped: number | null;
          last_success: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          consecutive_failures: number | null;
          last_error: string | null;
          auto_disabled: boolean | null;
          auto_discovered: boolean | null;
          description: string | null;
          requires_render: boolean | null;
          language: string | null;
          country: string | null;
          default_coordinates: Json | null;
          location_name: string | null;
          last_discovery_at: string | null;
          disabled_reason: string | null;
          volatility_score: number | null;
          next_scrape_at: string | null;
          consecutive_errors: number | null;
          last_rate_limit_remaining: number | null;
          last_rate_limit_reset_ts: string | null;
          last_rate_limit_retry_after_seconds: number | null;
          fetcher_type: string | null;
          consecutive_zero_events: number | null;
          last_non_zero_scrape: string | null;
          tier: string | null;
          preferred_method: string | null;
          deep_scrape_enabled: boolean | null;
          detected_cms: string | null;
          detected_framework_version: string | null;
          last_payload_hash: string | null;
          total_savings_prevented_runs: number | null;
        };
        Insert: {
          id?: string;
          name: string;
          url: string;
          enabled?: boolean;
          config?: Json;
          last_scraped_at?: string | null;
          total_events_scraped?: number | null;
          last_success?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          consecutive_failures?: number | null;
          last_error?: string | null;
          auto_disabled?: boolean | null;
          auto_discovered?: boolean | null;
          description?: string | null;
          requires_render?: boolean | null;
          language?: string | null;
          country?: string | null;
          default_coordinates?: Json | null;
          location_name?: string | null;
          last_discovery_at?: string | null;
          disabled_reason?: string | null;
          volatility_score?: number | null;
          next_scrape_at?: string | null;
          consecutive_errors?: number | null;
          last_rate_limit_remaining?: number | null;
          last_rate_limit_reset_ts?: string | null;
          last_rate_limit_retry_after_seconds?: number | null;
          fetcher_type?: string | null;
          consecutive_zero_events?: number | null;
          last_non_zero_scrape?: string | null;
          tier?: string | null;
          preferred_method?: string | null;
          deep_scrape_enabled?: boolean | null;
          detected_cms?: string | null;
          detected_framework_version?: string | null;
          last_payload_hash?: string | null;
          total_savings_prevented_runs?: number | null;
        };
        Update: {
          id?: string;
          name?: string;
          url?: string;
          enabled?: boolean;
          config?: Json;
          last_scraped_at?: string | null;
          total_events_scraped?: number | null;
          last_success?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          consecutive_failures?: number | null;
          last_error?: string | null;
          auto_disabled?: boolean | null;
          auto_discovered?: boolean | null;
          description?: string | null;
          requires_render?: boolean | null;
          language?: string | null;
          country?: string | null;
          default_coordinates?: Json | null;
          location_name?: string | null;
          last_discovery_at?: string | null;
          disabled_reason?: string | null;
          volatility_score?: number | null;
          next_scrape_at?: string | null;
          consecutive_errors?: number | null;
          last_rate_limit_remaining?: number | null;
          last_rate_limit_reset_ts?: string | null;
          last_rate_limit_retry_after_seconds?: number | null;
          fetcher_type?: string | null;
          consecutive_zero_events?: number | null;
          last_non_zero_scrape?: string | null;
          tier?: string | null;
          preferred_method?: string | null;
          deep_scrape_enabled?: boolean | null;
          detected_cms?: string | null;
          detected_framework_version?: string | null;
          last_payload_hash?: string | null;
          total_savings_prevented_runs?: number | null;
        };
        Relationships: [];
      };
      staged_events: {
        Row: {
          category: string | null;
          created_at: string | null;
          description: string | null;
          event_date: string | null;
          event_time: string | null;
          event_type: string | null;
          external_id: string | null;
          id: string;
          image_url: string | null;
          opening_hours: Json | null;
          raw_data: Json | null;
          source_id: string | null;
          time_mode: Database["public"]["Enums"]["time_mode"] | null;
          title: string;
          updated_at: string | null;
          venue_address: string | null;
          venue_name: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          event_type?: string | null;
          external_id?: string | null;
          id?: string;
          image_url?: string | null;
          opening_hours?: Json | null;
          raw_data?: Json | null;
          source_id?: string | null;
          time_mode?: Database["public"]["Enums"]["time_mode"] | null;
          title: string;
          updated_at?: string | null;
          venue_address?: string | null;
          venue_name?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          event_type?: string | null;
          external_id?: string | null;
          id?: string;
          image_url?: string | null;
          opening_hours?: Json | null;
          raw_data?: Json | null;
          source_id?: string | null;
          time_mode?: Database["public"]["Enums"]["time_mode"] | null;
          title?: string;
          updated_at?: string | null;
          venue_address?: string | null;
          venue_name?: string | null;
        };
        Relationships: [];
      };
      user_blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string | null;
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
      verified_venues: {
        Row: {
          address: string | null;
          aliases: string[] | null;
          created_at: string | null;
          id: string;
          is_verified: boolean | null;
          location: string | null;
          name: string;
        };
        Insert: {
          address?: string | null;
          aliases?: string[] | null;
          created_at?: string | null;
          id?: string;
          is_verified?: boolean | null;
          location?: string | null;
          name: string;
        };
        Update: {
          address?: string | null;
          aliases?: string[] | null;
          created_at?: string | null;
          id?: string;
          is_verified?: boolean | null;
          location?: string | null;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_friends_pulse: {
        Args: {
          current_user_id: string;
        };
        Returns: Json;
      };
      get_nearby_events: {
        Args: {
          user_lat: number;
          user_long: number;
          radius_km: number;
          limit_count: number;
          offset_count: number;
          filter_category: string[];
          filter_type: string[];
        };
        Returns: Json;
      };
      join_event_atomic: {
        Args: {
          p_event_id: string;
          p_profile_id: string;
          p_status?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      fetcher_type_enum: "static" | "puppeteer" | "playwright" | "scrapingbee";
      raw_event_status: "pending" | "processing" | "completed" | "failed";
      time_mode: "fixed" | "window" | "anytime";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof DatabaseWithoutInternals,
  "public"
>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends PublicEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      fetcher_type_enum: ["static", "puppeteer", "playwright", "scrapingbee"],
      raw_event_status: ["pending", "processing", "completed", "failed"],
      time_mode: ["fixed", "window", "anytime"],
    },
  },
} as const;
