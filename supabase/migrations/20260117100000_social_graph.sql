-- Social Graph Migration
-- This migration creates the user_relationships table for following/followers
-- and the get_friends_pulse RPC function for the Friends Pulse Rail

-- Create user_relationships table
CREATE TABLE IF NOT EXISTS public.user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique relationship between two users
  UNIQUE(follower_id, following_id),
  
  -- Prevent self-following
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_relationships_follower ON public.user_relationships(follower_id);
CREATE INDEX idx_user_relationships_following ON public.user_relationships(following_id);
CREATE INDEX idx_user_relationships_status ON public.user_relationships(status);
CREATE INDEX idx_user_relationships_created_at ON public.user_relationships(created_at DESC);

-- Enable RLS on user_relationships
ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own relationships (both as follower and following)
CREATE POLICY "Users can view their own relationships"
  ON public.user_relationships
  FOR SELECT
  TO authenticated
  USING (
    follower_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR
    following_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can create relationships where they are the follower
CREATE POLICY "Users can follow other users"
  ON public.user_relationships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    follower_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete relationships where they are the follower (unfollow)
CREATE POLICY "Users can unfollow users"
  ON public.user_relationships
  FOR DELETE
  TO authenticated
  USING (
    follower_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own relationship status (accept/reject follows if pending is used)
CREATE POLICY "Users can update relationship status"
  ON public.user_relationships
  FOR UPDATE
  TO authenticated
  USING (
    following_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_user_relationships_updated_at
  BEFORE UPDATE ON public.user_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_user_relationships_updated_at();

-- Create RPC function to get friends' pulse (activity status)
-- Returns friends who are attending events (live now or upcoming in next 24 hours)
CREATE OR REPLACE FUNCTION public.get_friends_pulse(current_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Get friends who have upcoming or current events
  -- Priority 1: Live Now (event is currently happening)
  -- Priority 2: Starting Soon (within next 24 hours)
  WITH friends AS (
    -- Get all accepted following relationships
    SELECT ur.following_id as friend_id
    FROM public.user_relationships ur
    WHERE ur.follower_id = current_user_id
      AND ur.status = 'accepted'
  ),
  friend_events AS (
    -- Get events that friends are attending
    SELECT 
      f.friend_id,
      p.id as user_id,
      p.full_name as first_name,
      p.avatar_url,
      e.id as event_id,
      e.title as event_title,
      e.category as event_category,
      e.event_date,
      e.event_time,
      -- Determine status: 'live' if event is now, 'upcoming' if within 24 hours
      CASE
        WHEN e.event_date::date = CURRENT_DATE 
          AND e.event_time IS NOT NULL 
          AND e.event_time != '' THEN 'live'
        WHEN e.event_date BETWEEN NOW() AND (NOW() + INTERVAL '24 hours') THEN 'upcoming'
        ELSE 'future'
      END as status,
      -- Sort priority: live first, then upcoming, then by event date
      CASE
        WHEN e.event_date::date = CURRENT_DATE 
          AND e.event_time IS NOT NULL 
          AND e.event_time != '' THEN 1
        WHEN e.event_date BETWEEN NOW() AND (NOW() + INTERVAL '24 hours') THEN 2
        ELSE 3
      END as priority
    FROM friends f
    INNER JOIN public.profiles p ON p.id = f.friend_id
    INNER JOIN public.event_attendees ea ON ea.profile_id = f.friend_id
    INNER JOIN public.events e ON e.id = ea.event_id
    WHERE ea.status = 'going'
      AND e.event_date >= CURRENT_DATE  -- Only future and current events
    ORDER BY priority, e.event_date, e.event_time
  )
  SELECT json_agg(
    json_build_object(
      'user', json_build_object(
        'id', fe.user_id,
        'avatar_url', fe.avatar_url,
        'first_name', fe.first_name
      ),
      'status', fe.status,
      'event', json_build_object(
        'id', fe.event_id,
        'title', fe.event_title,
        'category', fe.event_category
      )
    )
  ) INTO result
  FROM friend_events fe
  WHERE fe.status IN ('live', 'upcoming');
  
  -- Return empty array if no results
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE public.user_relationships IS 'Stores follower/following relationships for social graph';
COMMENT ON COLUMN public.user_relationships.status IS 'Relationship status: pending (awaiting acceptance), accepted (active relationship)';
COMMENT ON FUNCTION public.get_friends_pulse IS 'Returns friends activity status - who is at events now or soon';
