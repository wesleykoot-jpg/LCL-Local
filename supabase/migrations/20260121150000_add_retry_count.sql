-- Add missing retry_count column for auto-recovery
ALTER TABLE "raw_event_staging" 
ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "error_message" TEXT;

COMMENT ON COLUMN "raw_event_staging"."retry_count" IS 'Number of times this row has been retried after failures';
COMMENT ON COLUMN "raw_event_staging"."error_message" IS 'Last error message if processing failed';
