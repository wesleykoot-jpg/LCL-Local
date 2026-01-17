-- Migration: Add Event Privacy and Invites
-- Date: 2026-01-16
-- Description: Adds is_private column to events table and creates event_invites table for invite system

-- Add is_private column to events table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE public.events ADD COLUMN is_private BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;
END $$;

-- Add index on is_private for filtering
CREATE INDEX IF NOT EXISTS idx_events_is_private ON public.events(is_private);

-- Add comment for documentation
COMMENT ON COLUMN public.events.is_private IS 'Whether this event is private (invite-only)';

-- Create event_invites table
CREATE TABLE IF NOT EXISTS public.event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique invite per user per event
  UNIQUE(event_id, invited_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON public.event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_invited_user_id ON public.event_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_invited_by ON public.event_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_event_invites_status ON public.event_invites(status);

-- Enable RLS on event_invites
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view invites they sent or received
CREATE POLICY "Users can view their own invites"
  ON public.event_invites
  FOR SELECT
  TO authenticated
  USING (
    invited_user_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR
    invited_by IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can create invites for their own events
CREATE POLICY "Event creators can invite users"
  ON public.event_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Check if the user creating the invite is the event creator
    invited_by IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.created_by = invited_by
    )
  );

-- RLS Policy: Invited users can update their invite status (accept/decline)
CREATE POLICY "Invited users can update invite status"
  ON public.event_invites
  FOR UPDATE
  TO authenticated
  USING (
    invited_user_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    invited_user_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Event creators can delete invites for their events
CREATE POLICY "Event creators can delete invites"
  ON public.event_invites
  FOR DELETE
  TO authenticated
  USING (
    invited_by IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.created_by = invited_by
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_event_invites_updated_at ON public.event_invites;
CREATE TRIGGER update_event_invites_updated_at
  BEFORE UPDATE ON public.event_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_event_invites_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.event_invites IS 'Stores event invitations for private events';
COMMENT ON COLUMN public.event_invites.status IS 'Invite status: pending (awaiting response), accepted (user accepted), declined (user declined)';
COMMENT ON COLUMN public.event_invites.invited_user_id IS 'Profile ID of the user being invited';
COMMENT ON COLUMN public.event_invites.invited_by IS 'Profile ID of the user who sent the invite (event creator)';

-- Rollback SQL (run this to undo the migration):
-- DROP TABLE IF EXISTS public.event_invites CASCADE;
-- DROP FUNCTION IF EXISTS update_event_invites_updated_at() CASCADE;
-- DROP INDEX IF EXISTS idx_events_is_private;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS is_private;
