/**
 * Social Graph Intelligence Pipeline - Shared Environment
 * 
 * Centralized environment variables for all SG pipeline Edge Functions.
 * 
 * @module _shared/sgEnv
 */

// Core Supabase
export const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
export const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// AI / LLM
export const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

// Search Discovery
export const serperApiKey = Deno.env.get("SERPER_API_KEY") || "7e33f011dce62fce0320136c09803dd9e5ed150d";

// Browser Rendering (optional)
export const browserlessApiKey = Deno.env.get("BROWSERLESS_API_KEY") || "";
export const browserlessEndpoint = Deno.env.get("BROWSERLESS_ENDPOINT") || "https://chrome.browserless.io";

// Rate Limiting Config
export const NOMINATIM_RATE_LIMIT_MS = 1000; // 1 request per second
export const SERPER_DAILY_LIMIT = 2500; // Free tier
export const OPENAI_RPM_LIMIT = 500;

// Pipeline Config
export const MAX_RETRY_ATTEMPTS = 3;
export const BACKOFF_BASE_MS = 1000;
export const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Validate that all required environment variables are set
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const required = [
    { key: "SUPABASE_URL", value: supabaseUrl },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: supabaseServiceRoleKey },
    { key: "OPENAI_API_KEY", value: openAiApiKey },
  ];

  const missing = required
    .filter(({ value }) => !value)
    .map(({ key }) => key);

  return {
    valid: missing.length === 0,
    missing,
  };
}
