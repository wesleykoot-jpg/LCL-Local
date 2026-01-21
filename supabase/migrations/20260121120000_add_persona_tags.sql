-- Migration: Add persona_tags to events table

ALTER TABLE "events" 
ADD COLUMN IF NOT EXISTS "persona_tags" text[];

COMMENT ON COLUMN "events"."persona_tags" IS 'Array of persona tags (e.g., #Culture, #Nightlife) derived from AI analysis';
