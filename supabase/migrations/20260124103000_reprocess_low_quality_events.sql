CREATE OR REPLACE FUNCTION public.reprocess_low_quality_events()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    processed_count integer := 0;
    row_record record;
BEGIN
    -- Identify upcoming events with missing images that have a source_url
    FOR row_record IN 
        SELECT id, source_id, source_url, title
        FROM events 
        WHERE (image_url IS NULL OR image_url = '') 
          AND source_url IS NOT NULL 
          AND event_date >= NOW()
    LOOP
        -- Insert into staging table, or update if URL already exists
        -- We set status to 'pending' to trigger the worker
        INSERT INTO raw_event_staging (
            source_id, 
            source_url, 
            status, 
            parsing_method
        )
        VALUES (
            row_record.source_id, 
            row_record.source_url, 
            'pending', 
            'ai'
        )
        ON CONFLICT (source_url) 
        DO UPDATE SET 
            status = 'pending',
            updated_at = NOW();
            
        processed_count := processed_count + 1;
    END LOOP;

    RETURN json_build_object(
        'status', 'success',
        'requeued_count', processed_count
    );
END;
$function$;
