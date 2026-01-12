-- Migration: Add Google Calendar tokens table
-- Purpose: Store OAuth tokens for Google Calendar integration

-- Create table to store Google Calendar OAuth tokens
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ NOT NULL,
    calendar_id TEXT DEFAULT 'primary',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id)
);

-- Create table to track synced calendar events
CREATE TABLE IF NOT EXISTS google_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, event_id)
);

-- Add RLS policies for google_calendar_tokens
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view own calendar tokens"
    ON google_calendar_tokens
    FOR SELECT
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Users can insert their own tokens
CREATE POLICY "Users can insert own calendar tokens"
    ON google_calendar_tokens
    FOR INSERT
    WITH CHECK (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Users can update their own tokens
CREATE POLICY "Users can update own calendar tokens"
    ON google_calendar_tokens
    FOR UPDATE
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Users can delete their own tokens
CREATE POLICY "Users can delete own calendar tokens"
    ON google_calendar_tokens
    FOR DELETE
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Add RLS policies for google_calendar_events
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own synced events
CREATE POLICY "Users can view own synced events"
    ON google_calendar_events
    FOR SELECT
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Users can insert their own synced events
CREATE POLICY "Users can insert own synced events"
    ON google_calendar_events
    FOR INSERT
    WITH CHECK (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Users can update their own synced events
CREATE POLICY "Users can update own synced events"
    ON google_calendar_events
    FOR UPDATE
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Users can delete their own synced events
CREATE POLICY "Users can delete own synced events"
    ON google_calendar_events
    FOR DELETE
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Create updated_at trigger for google_calendar_tokens
CREATE OR REPLACE FUNCTION update_google_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_calendar_tokens_updated_at
    BEFORE UPDATE ON google_calendar_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_google_calendar_tokens_updated_at();

-- Create updated_at trigger for google_calendar_events
CREATE OR REPLACE FUNCTION update_google_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_calendar_events_updated_at
    BEFORE UPDATE ON google_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_google_calendar_events_updated_at();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_profile_id ON google_calendar_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_profile_id ON google_calendar_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_event_id ON google_calendar_events(event_id);
