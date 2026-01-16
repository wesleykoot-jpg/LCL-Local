-- Safety & Compliance Infrastructure Migration
-- This migration creates tables for user blocking and content reporting
-- Required for App Store and Play Store approval

-- Create user_blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure a user can't block the same person twice
  UNIQUE(blocker_id, blocked_id),
  
  -- Prevent self-blocking
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);
CREATE INDEX idx_user_blocks_created_at ON public.user_blocks(created_at DESC);

-- Enable RLS on user_blocks
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only INSERT where blocker_id = auth.uid()
CREATE POLICY "Users can block other users"
  ON public.user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    blocker_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can view their own blocks
CREATE POLICY "Users can view their own blocks"
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (
    blocker_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own blocks (unblock)
CREATE POLICY "Users can unblock users"
  ON public.user_blocks
  FOR DELETE
  TO authenticated
  USING (
    blocker_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Create content_reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure at least one target is specified (event or user)
  CONSTRAINT must_report_something CHECK (
    event_id IS NOT NULL OR reported_user_id IS NOT NULL
  )
);

-- Create indexes for performance
CREATE INDEX idx_content_reports_reporter ON public.content_reports(reporter_id);
CREATE INDEX idx_content_reports_event ON public.content_reports(event_id);
CREATE INDEX idx_content_reports_reported_user ON public.content_reports(reported_user_id);
CREATE INDEX idx_content_reports_status ON public.content_reports(status);
CREATE INDEX idx_content_reports_created_at ON public.content_reports(created_at DESC);

-- Enable RLS on content_reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can insert their own reports
CREATE POLICY "Users can report content"
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can view their own reports
CREATE POLICY "Users can view their own reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Admins can view all reports
-- Note: This will need to be configured with admin role checks
-- For now, we'll use a simple approach that can be enhanced later
CREATE POLICY "Admins can view all reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND (full_name ILIKE '%admin%' OR full_name ILIKE '%moderator%')
    )
  );

-- RLS Policy: Admins can update reports (resolve, dismiss)
CREATE POLICY "Admins can update reports"
  ON public.content_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND (full_name ILIKE '%admin%' OR full_name ILIKE '%moderator%')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_content_reports_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_content_reports_updated_at();

-- Add comment to tables for documentation
COMMENT ON TABLE public.user_blocks IS 'Stores user blocking relationships for content filtering and safety';
COMMENT ON TABLE public.content_reports IS 'Stores user reports for offensive content, spam, or policy violations';
COMMENT ON COLUMN public.content_reports.reason IS 'User-provided reason: Offensive, Spam, Illegal, Harassment, etc.';
COMMENT ON COLUMN public.content_reports.status IS 'Report status: pending (needs review), resolved (action taken), dismissed (no action needed)';
