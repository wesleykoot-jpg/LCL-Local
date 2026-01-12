import { supabase } from '@/integrations/supabase/client';

export interface ScrapeResult {
  success: boolean;
  totalScraped: number;
  parsedByAI: number;
  inserted: number;
  skipped: number;
  failed: number;
  error?: string;
}

export async function triggerScraper(): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-events');
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data as ScrapeResult;
}
