import { supabase } from '@/integrations/supabase/client';

export interface SourceResult {
  sourceId: string;
  sourceName: string;
  totalScraped: number;
  parsedByAI: number;
  inserted: number;
  skipped: number;
  failed: number;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  sources?: SourceResult[];
  totals?: {
    totalScraped: number;
    parsedByAI: number;
    inserted: number;
    skipped: number;
    failed: number;
  };
  // Legacy fields for backward compatibility
  totalScraped?: number;
  parsedByAI?: number;
  inserted?: number;
  skipped?: number;
  failed?: number;
  message?: string;
  error?: string;
}

export async function triggerScraper(): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-events');
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data as ScrapeResult;
}
