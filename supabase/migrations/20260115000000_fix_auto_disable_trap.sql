-- Fix auto_disabled trap: Reset auto_disabled when enabled is set to true
-- This allows manually re-enabling sources that were auto-disabled due to failures

-- Create trigger function to reset auto_disabled when enabled is set to true
CREATE OR REPLACE FUNCTION reset_auto_disabled_on_enable()
RETURNS TRIGGER AS $$
BEGIN
  -- If enabled is being set to true and auto_disabled is true, reset auto_disabled
  IF NEW.enabled = true AND OLD.auto_disabled = true THEN
    NEW.auto_disabled := false;
    NEW.consecutive_failures := 0;  -- Also reset failure counter for fresh start
    RAISE NOTICE 'Auto-disabled flag reset for source %: enabled=true, auto_disabled=false', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on scraper_sources to reset auto_disabled when enabled
CREATE TRIGGER reset_auto_disabled_on_enable_trigger
  BEFORE UPDATE OF enabled ON scraper_sources
  FOR EACH ROW
  WHEN (NEW.enabled = true AND OLD.auto_disabled = true)
  EXECUTE FUNCTION reset_auto_disabled_on_enable();

-- Comment for documentation
COMMENT ON FUNCTION reset_auto_disabled_on_enable() IS 
'Automatically resets auto_disabled flag and consecutive_failures when a source is manually re-enabled. This prevents the auto_disabled trap where sources with auto_disabled=true remain blocked even after being manually enabled.';

-- Add index to optimize coordinator query that filters by both enabled and auto_disabled
CREATE INDEX IF NOT EXISTS idx_scraper_sources_enabled_not_auto_disabled 
ON scraper_sources (id) 
WHERE enabled = true AND auto_disabled = false;

COMMENT ON INDEX idx_scraper_sources_enabled_not_auto_disabled IS 
'Optimizes the scrape-coordinator query that filters for enabled sources that are not auto-disabled';
