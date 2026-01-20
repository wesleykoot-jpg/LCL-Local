// env.ts
// Centralized environment variables for Edge Functions
export const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
export const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
export const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
