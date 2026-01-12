-- =====================================================
-- Google Calendar Integration Schema
-- =====================================================

-- Table to store user's calendar integration settings
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  calendar_id text, -- The primary calendar ID to sync with
  sync_enabled boolean DEFAULT true,
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, provider)
);

-- Table to map local events to calendar events
CREATE TABLE IF NOT EXISTS calendar_event_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
  external_event_id text NOT NULL, -- The ID in the external calendar (e.g., Google Calendar event ID)
  external_calendar_id text NOT NULL, -- The calendar ID where the event was created
  last_synced_at timestamptz DEFAULT now(),
  sync_status text DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, profile_id, integration_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_profile ON calendar_integrations(profile_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_provider ON calendar_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_event ON calendar_event_mappings(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_profile ON calendar_event_mappings(profile_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_integration ON calendar_event_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_external ON calendar_event_mappings(external_event_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_mappings ENABLE ROW LEVEL SECURITY;

-- Calendar integrations policies
CREATE POLICY "Users can view own calendar integrations"
  ON calendar_integrations
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can create own calendar integrations"
  ON calendar_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own calendar integrations"
  ON calendar_integrations
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own calendar integrations"
  ON calendar_integrations
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- Calendar event mappings policies
CREATE POLICY "Users can view own calendar event mappings"
  ON calendar_event_mappings
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can create own calendar event mappings"
  ON calendar_event_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own calendar event mappings"
  ON calendar_event_mappings
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own calendar event mappings"
  ON calendar_event_mappings
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_event_mappings_updated_at
  BEFORE UPDATE ON calendar_event_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
