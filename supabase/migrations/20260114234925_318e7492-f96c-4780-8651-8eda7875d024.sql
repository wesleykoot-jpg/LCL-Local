-- Create the get_effective_rate_limit function that the scraper needs
CREATE OR REPLACE FUNCTION public.get_effective_rate_limit(p_source_id UUID)
RETURNS TABLE(
  requests_per_minute INTEGER,
  max_concurrent INTEGER,
  delay_between_requests_ms INTEGER
) AS $$
BEGIN
  -- Return default rate limits
  -- Can be extended to read from a rate_limits table per source
  RETURN QUERY SELECT 
    10::INTEGER as requests_per_minute,
    2::INTEGER as max_concurrent,
    1000::INTEGER as delay_between_requests_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;