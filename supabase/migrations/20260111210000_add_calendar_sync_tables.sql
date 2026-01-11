/*
  # Calendar Sync Tables Migration
  
  This migration adds tables to support Google Calendar and Microsoft Outlook
  calendar synchronization for LCL events.
  
  1. New Tables
    - `user_calendar_accounts`
      - Stores OAuth tokens and settings for connected calendar providers
      - Supports Google and Microsoft calendar providers
      - Encrypted token storage (application-level encryption)
    
    - `event_calendar_mappings`
      - Maps LCL events to provider calendar events
      - Tracks sync status and provider-specific metadata
      - Enables idempotent sync operations
  
  2. Security
    - Enable RLS on all new tables
    - Users can only access their own calendar accounts
    - Users can only see mappings for events they attend
*/

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Calendar provider enum
DO $$ BEGIN
  CREATE TYPE calendar_provider AS ENUM ('google', 'microsoft');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Calendar sync status enum
DO $$ BEGIN
  CREATE TYPE calendar_sync_status AS ENUM ('pending', 'synced', 'failed', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- USER CALENDAR ACCOUNTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  provider_account_id text NOT NULL,
  provider_email text,
  primary_calendar_id text,
  -- Tokens are encrypted at the application level before storage
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  sync_enabled boolean DEFAULT true NOT NULL,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- Ensure one account per provider per user
  UNIQUE(user_id, provider)
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_user_calendar_accounts_user_id 
  ON user_calendar_accounts(user_id);

-- Index for finding accounts needing token refresh
CREATE INDEX IF NOT EXISTS idx_user_calendar_accounts_token_expires 
  ON user_calendar_accounts(token_expires_at) 
  WHERE sync_enabled = true;

-- =====================================================
-- EVENT CALENDAR MAPPINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS event_calendar_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_account_id uuid NOT NULL REFERENCES user_calendar_accounts(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  provider_event_id text NOT NULL,
  provider_event_etag text,
  -- Store LCL event ID in provider for idempotency
  lcl_external_id text NOT NULL,
  status calendar_sync_status DEFAULT 'pending' NOT NULL,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- Ensure one mapping per event per calendar account
  UNIQUE(event_id, calendar_account_id)
);

-- Index for finding mappings by event
CREATE INDEX IF NOT EXISTS idx_event_calendar_mappings_event_id 
  ON event_calendar_mappings(event_id);

-- Index for finding mappings by user
CREATE INDEX IF NOT EXISTS idx_event_calendar_mappings_user_id 
  ON event_calendar_mappings(user_id);

-- Index for finding mappings by calendar account
CREATE INDEX IF NOT EXISTS idx_event_calendar_mappings_account 
  ON event_calendar_mappings(calendar_account_id);

-- Index for finding pending syncs
CREATE INDEX IF NOT EXISTS idx_event_calendar_mappings_pending 
  ON event_calendar_mappings(status) 
  WHERE status = 'pending';

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE user_calendar_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_calendar_mappings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER CALENDAR ACCOUNTS POLICIES
-- =====================================================

-- Users can view their own calendar accounts
CREATE POLICY "Users can view own calendar accounts"
  ON user_calendar_accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own calendar accounts
CREATE POLICY "Users can create own calendar accounts"
  ON user_calendar_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own calendar accounts
CREATE POLICY "Users can update own calendar accounts"
  ON user_calendar_accounts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own calendar accounts
CREATE POLICY "Users can delete own calendar accounts"
  ON user_calendar_accounts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- EVENT CALENDAR MAPPINGS POLICIES
-- =====================================================

-- Users can view their own calendar mappings
CREATE POLICY "Users can view own calendar mappings"
  ON event_calendar_mappings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own calendar mappings
CREATE POLICY "Users can create own calendar mappings"
  ON event_calendar_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own calendar mappings
CREATE POLICY "Users can update own calendar mappings"
  ON event_calendar_mappings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own calendar mappings
CREATE POLICY "Users can delete own calendar mappings"
  ON event_calendar_mappings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at on user_calendar_accounts
CREATE TRIGGER update_user_calendar_accounts_updated_at
  BEFORE UPDATE ON user_calendar_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on event_calendar_mappings
CREATE TRIGGER update_event_calendar_mappings_updated_at
  BEFORE UPDATE ON event_calendar_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
