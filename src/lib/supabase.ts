/**
 * Supabase client wrappers for scraper data.
 * Handles scrape_events and scrape_state tables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config/defaults';
import fs from 'fs';
import path from 'path';

export interface ScrapeEvent {
  id?: string;
  run_id: string;
  source_id: string;
  url: string;
  http_status: number | null;
  success: boolean;
  etag?: string | null;
  last_modified?: string | null;
  body?: string | null;
  error?: string | null;
  headers?: Record<string, any> | null;
  raw_response_summary?: string | null;
  created_at?: string;
}

export interface ScrapeState {
  source_id: string;
  last_success_at?: string | null;
  last_run_at?: string | null;
  consecutive_failures?: number;
  last_alert_at?: string | null;
  last_etag?: string | null;
  last_last_modified?: string | null;
  last_http_status?: number | null;
  note?: string | null;
  updated_at?: string;
}

export interface Source {
  source_id: string;
  url: string;
  domain: string;
  rate_limit?: {
    requests_per_minute?: number;
    concurrency?: number;
  };
}

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const config = getConfig();
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
    }
    supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return supabaseClient;
}

/**
 * Insert a scrape event record
 */
export async function insertScrapeEvent(event: ScrapeEvent): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('scrape_events')
    .insert(event);
  
  if (error) {
    throw new Error(`Failed to insert scrape event: ${error.message}`);
  }
}

/**
 * Upsert scrape state for a source
 */
export async function upsertScrapeState(state: ScrapeState): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('scrape_state')
    .upsert(state, { onConflict: 'source_id' });
  
  if (error) {
    throw new Error(`Failed to upsert scrape state: ${error.message}`);
  }
}

/**
 * Get scrape state for a source
 */
export async function getScrapeState(source_id: string): Promise<ScrapeState | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('scrape_state')
    .select('*')
    .eq('source_id', source_id)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Failed to get scrape state: ${error.message}`);
  }
  
  return data;
}

/**
 * Load sources from sources.json
 * Looks for the file relative to the current working directory
 * Note: Expects to be run from the project root
 */
export function listSources(): Source[] {
  const sourcesPath = path.join(process.cwd(), 'src/config/sources.json');
  
  if (!fs.existsSync(sourcesPath)) {
    throw new Error(
      `Sources file not found at ${sourcesPath}. ` +
      `Make sure to run the scraper from the project root directory.`
    );
  }
  
  const sourcesJson = fs.readFileSync(sourcesPath, 'utf-8');
  const sources = JSON.parse(sourcesJson) as Source[];
  
  return sources;
}

/**
 * Get recent scrape events for a source
 */
export async function getRecentEvents(
  source_id: string,
  limit: number = 10
): Promise<ScrapeEvent[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('scrape_events')
    .select('*')
    .eq('source_id', source_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to get recent events: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get events for a specific run
 */
export async function getRunEvents(run_id: string): Promise<ScrapeEvent[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('scrape_events')
    .select('*')
    .eq('run_id', run_id)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get run events: ${error.message}`);
  }
  
  return data || [];
}
