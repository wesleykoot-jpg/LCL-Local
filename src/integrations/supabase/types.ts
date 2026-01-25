export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
          details: string | null;
          event_id: string | null;
          id: string;
          reason: string;
          reporter_id: string | null;
          resolution_notes: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          details?: string | null;
          event_id?: string | null;
          id?: string;
          reason: string;
          reporter_id?: string | null;
          resolution_notes?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          details?: string | null;
          event_id?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string | null;
          resolution_notes?: string | null;
          status?: string | null;
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
            foreignKeyName: "content_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_jobs: {
        Row: {
          city_id: string | null;
          completed_at: string | null;
          created_at: string | null;
          error_message: string | null;
          events_found: number | null;
          id: string;
          started_at: string | null;
          status: string | null;
        };
        Insert: {
          city_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          events_found?: number | null;
          id?: string;
          started_at?: string | null;
          status?: string | null;
        };
        Update: {
          city_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          events_found?: number | null;
          id?: string;
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
        ];
      };
      error_logs: {
        Row: {
          created_at: string | null;
          error_data: Json | null;
          error_message: string;
          id: string;
          severity: string | null;
          source: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_data?: Json | null;
          error_message: string;
          id?: string;
          severity?: string | null;
          source?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_data?: Json | null;
          error_message?: string;
          id?: string;
          severity?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      event_attendees: {
        Row: {
          event_id: string;
          joined_at: string | null;
          profile_id: string;
          status: string | null;
          ticket_number: string | null;
        };
        Insert: {
          event_id: string;
          joined_at?: string | null;
          profile_id: string;
          status?: string | null;
          ticket_number?: string | null;
        };
        Update: {
          event_id?: string;
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
          invite_code: string;
          max_uses: number | null;
          used_count: number | null;
        };
        Insert: {
          created_at?: string | null;
          event_id?: string | null;
          id?: string;
          invite_code: string;
          max_uses?: number | null;
          used_count?: number | null;
        };
        Update: {
          created_at?: string | null;
          event_id?: string | null;
          id?: string;
          invite_code?: string;
          max_uses?: number | null;
          used_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_invites_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          category: string;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          event_date: string;
          event_time: string | null;
          id: string;
          image_url: string | null;
          location: Database["public"]["CompositeTypes"]["geography"] | null;
          parent_event_id: string | null;
          source_id: string | null;
          source_url: string | null;
          title: string;
          venue_name: string | null;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          event_date: string;
          event_time?: string | null;
          id?: string;
          image_url?: string | null;
          location?: Database["public"]["CompositeTypes"]["geography"] | null;
          parent_event_id?: string | null;
          source_id?: string | null;
          source_url?: string | null;
          title: string;
          venue_name?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          event_date?: string;
          event_time?: string | null;
          id?: string;
          image_url?: string | null;
          location?: Database["public"]["CompositeTypes"]["geography"] | null;
          parent_event_id?: string | null;
          source_id?: string | null;
          source_url?: string | null;
          title?: string;
          venue_name?: string | null;
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
        ];
      };
      geocode_cache: {
        Row: {
          address: string;
          coordinates: Database["public"]["CompositeTypes"]["geography"] | null;
          created_at: string | null;
          id: string;
          last_used_at: string | null;
        };
        Insert: {
          address: string;
          coordinates?:
            | Database["public"]["CompositeTypes"]["geography"]
            | null;
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
        };
        Update: {
          address?: string;
          coordinates?:
            | Database["public"]["CompositeTypes"]["geography"]
            | null;
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      persona_badges: {
        Row: {
          awarded_at: string | null;
          badge_type: string;
          id: string;
          profile_id: string | null;
        };
        Insert: {
          awarded_at?: string | null;
          badge_type: string;
          id?: string;
          profile_id?: string | null;
        };
        Update: {
          awarded_at?: string | null;
          badge_type?: string;
          id?: string;
          profile_id?: string | null;
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
          host_rating: number | null;
          id: string;
          last_updated: string | null;
          newcomers_welcomed: number | null;
          profile_id: string | null;
          rallies_hosted: number | null;
        };
        Insert: {
          host_rating?: number | null;
          id?: string;
          last_updated?: string | null;
          newcomers_welcomed?: number | null;
          profile_id?: string | null;
          rallies_hosted?: number | null;
        };
        Update: {
          host_rating?: number | null;
          id?: string;
          last_updated?: string | null;
          newcomers_welcomed?: number | null;
          profile_id?: string | null;
          rallies_hosted?: number | null;
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
          location_coordinates:
            | Database["public"]["CompositeTypes"]["geography"]
            | null;
          location_country: string | null;
          reliability_score: number | null;
          verified_resident: boolean | null;
        };
        Insert: {
          avatar_url?: string | null;
          current_persona?: string | null;
          events_attended?: number | null;
          events_committed?: number | null;
          full_name?: string | null;
          id: string;
          location_city?: string | null;
          location_coordinates?:
            | Database["public"]["CompositeTypes"]["geography"]
            | null;
          location_country?: string | null;
          reliability_score?: number | null;
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
          location_coordinates?:
            | Database["public"]["CompositeTypes"]["geography"]
            | null;
          location_country?: string | null;
          reliability_score?: number | null;
          verified_resident?: boolean | null;
        };
        Relationships: [];
      };
      raw_events: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          id: string;
          processed_at: string | null;
          raw_content: Json | null;
          source_id: string | null;
          source_url: string;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          processed_at?: string | null;
          raw_content?: Json | null;
          source_id?: string | null;
          source_url: string;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          processed_at?: string | null;
          raw_content?: Json | null;
          source_id?: string | null;
          source_url?: string;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "raw_events_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "scraper_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      scrape_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          error_message: string | null;
          events_found: number | null;
          id: string;
          source_id: string | null;
          started_at: string | null;
          status: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          events_found?: number | null;
          id?: string;
          source_id?: string | null;
          started_at?: string | null;
          status?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          events_found?: number | null;
          id?: string;
          source_id?: string | null;
          started_at?: string | null;
          status?: string | null;
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
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          last_polled: string | null;
          name: string;
          polling_interval_mins: number | null;
          source_url: string;
          strategy: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_polled?: string | null;
          name: string;
          polling_interval_mins?: number | null;
          source_url: string;
          strategy?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_polled?: string | null;
          name?: string;
          polling_interval_mins?: number | null;
          source_url?: string;
          strategy?: string | null;
        };
        Relationships: [];
      };
      verified_venues: {
        Row: {
          address: string | null;
          aliases: string[] | null;
          created_at: string | null;
          id: string;
          is_verified: boolean | null;
          location: Database["public"]["CompositeTypes"]["geography"] | null;
          name: string;
        };
        Insert: {
          address?: string | null;
          aliases?: string[] | null;
          created_at?: string | null;
          id?: string;
          is_verified?: boolean | null;
          location?: Database["public"]["CompositeTypes"]["geography"] | null;
          name: string;
        };
        Update: {
          address?: string | null;
          aliases?: string[] | null;
          created_at?: string | null;
          id?: string;
          is_verified?: boolean | null;
          location?: Database["public"]["CompositeTypes"]["geography"] | null;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      source_health_with_insights: {
        Row: {
          avg_events_per_run: number | null;
          error_rate: number | null;
          last_error: string | null;
          last_run_at: string | null;
          source_id: string | null;
          source_name: string | null;
          success_rate: number | null;
          total_runs: number | null;
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
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      fetcher_type_enum: "static" | "puppeteer" | "playwright" | "scrapingbee";
      raw_event_status: "pending" | "processing" | "completed" | "failed";
    };
    CompositeTypes: {
      geography: string;
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
