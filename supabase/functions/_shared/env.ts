// env.ts
// Centralized environment variables for Edge Functions
export const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
export const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
export const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
export const glmApiKey = Deno.env.get("GLM_API_KEY") || "";

// Social Graph Intelligence Pipeline
export const serperApiKey = Deno.env.get("SERPER_API_KEY") || "";
export const browserlessApiKey = Deno.env.get("BROWSERLESS_API_KEY") || "";
export const browserlessEndpoint = Deno.env.get("BROWSERLESS_ENDPOINT") || "https://chrome.browserless.io";
