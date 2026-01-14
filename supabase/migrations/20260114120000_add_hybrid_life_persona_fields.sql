-- Migration: Add Hybrid Life Persona System Fields
-- Purpose: Add fields for implicit persona detection and interest tracking

-- Add is_parent_detected field to profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS is_parent_detected boolean DEFAULT false;

-- Add interest_scores field to profiles for tracking interaction counts per category
-- Structure: { "family": 5, "active": 3, "social": 2, ... }
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS interest_scores jsonb DEFAULT '{}'::jsonb;

-- Create index for interest_scores to optimize queries
CREATE INDEX IF NOT EXISTS idx_profiles_interest_scores ON public.profiles USING GIN(interest_scores);

-- Create index for is_parent_detected for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_parent_detected ON public.profiles(is_parent_detected);

COMMENT ON COLUMN public.profiles.is_parent_detected IS 
  'Automatically detected if user is a parent based on interest patterns and calendar signals';

COMMENT ON COLUMN public.profiles.interest_scores IS 
  'JSONB object tracking interaction counts per category ID (views, likes) for implicit preference learning';
