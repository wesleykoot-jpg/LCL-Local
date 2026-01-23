import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  withErrorLogging,
  logHttpError,
  logSupabaseError,
} from "../_shared/errorLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Sportlink Credentials
const SPORTLINK_CLIENT_ID = "oCuV9oozaaz8zee";
const SPORTLINK_CLIENT_SECRET = "eep7Shoo7i";
// Use credentials from user's successful cURL to rule out account issues
const SPORTLINK_USER = "wesleykoot@gmail.com";
const SPORTLINK_PASS = "Jejwyz-qoxco6-fitmob";

const SPORTLINK_AUTH_URL =
  "https://app-vnl-production.sportlink.com/oauth/token";
const SPORTLINK_API_BASE = "https://data.sportlink.com";

const CLUBS = [
  {
    id: "BBBF60T",
    name: "F.c. Meppel",
    location: "POINT(6.1865 52.6865)",
    venueName: "F.c. Meppel ground",
    sourceUrl: "https://www.fcmeppel.nl/programma/",
    sourceId: "c4601bcf-abe4-420d-af6d-1069a22bc14d",
  },
];

const APP_HEADERS = {
  "X-Real-User-Agent":
    "sportlink-app-voetbalnl/6.26.0-2025017636 android SM-N976N/samsung/25 (6.26.0)",
  "X-Navajo-Instance": "KNVB",
  "X-Navajo-Locale": "nl",
  "X-Navajo-Version": "2",
  "User-Agent": "okhttp/4.12.0",
};

async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("client_id", SPORTLINK_CLIENT_ID);
  params.append("secret", SPORTLINK_CLIENT_SECRET);
  params.append("username", SPORTLINK_USER);
  params.append("password", SPORTLINK_PASS);

  console.log(`[Sportlink] Requesting token for user ${SPORTLINK_USER}...`);
  const response = await fetch(SPORTLINK_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "okhttp/4.12.0",
    },
    body: params,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Sportlink] Token failed: ${response.status} ${errorBody}`);
    await logHttpError(
      "sportlink-ingest",
      "getAccessToken",
      "Fetch OAuth token",
      SPORTLINK_AUTH_URL,
      response.status,
      errorBody,
    );
    throw new Error(`Failed to get Sportlink access token: ${response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    console.error(
      `[Sportlink] Token response missing access_token:`,
      JSON.stringify(data),
    );
  } else {
    console.log(
      `[Sportlink] Token received successfully. Expires in: ${data.expires_in}`,
    );
  }
  return data;
}

async function searchClubs(accessToken: string, query: string) {
  const baseUrl = "https://app-vnl-production.sportlink.com";
  const endpoint = "/entity/common/memberportal/app/club/ClubSearch";
  const url = `${baseUrl}${endpoint}?v=2&q=${encodeURIComponent(query)}`;

  console.log(`[Sportlink] Searching clubs via App-VNL: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...APP_HEADERS,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Sportlink] Search failed: ${response.status} ${errorBody}`);
    return { error: errorBody, status: response.status };
  }

  const data = await response.json();
  return data;
}

async function fetchClubProgram(accessToken: string, clubId: string) {
  const baseUrl = "https://app-vnl-production.sportlink.com";
  const endpoint = "/entity/common/memberportal/app/club/ClubProgram";

  const params = new URLSearchParams({
    clubcode: clubId,
    aantaldagen: "60",
    weekoffset: "0",
    eigenwedstrijden: "JA",
    thuis: "JA",
    uit: "JA",
  });

  const url = `${baseUrl}${endpoint}?${params.toString()}`;

  console.log(`[Sportlink] Fetching via App-VNL endpoint (GET): ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...APP_HEADERS,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[Sportlink] App-VNL GET failed: ${response.status} ${errorBody}`,
    );
    await logHttpError(
      "sportlink-ingest",
      "fetchClubProgram",
      "Fetch App-VNL Program",
      url,
      response.status,
      errorBody,
    );
    return { program: [], raw: { error: errorBody, status: response.status } };
  }

  const rawData = await response.json();
  const program = rawData.programma?.output?.[0]?.columns || []; // Attempt to extract if standard Navajo format
  // Or if it's a flat list, we'll see.
  // Based on schema, output is `output` array.

  return { program, raw: rawData };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  return withErrorLogging(
    "sportlink-ingest",
    "handler",
    "Execute Sportlink Ingestion",
    async () => {
      const url = new URL(req.url);
      const action = url.searchParams.get("action") || "ingest";
      const query = url.searchParams.get("q");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (action === "ingest" || action === "debug" || action === "search") {
        const authData = await getAccessToken();

        if (!authData.access_token) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Authentication failed",
              authResponse: authData,
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const token = authData.access_token;

        if (action === "search") {
          if (!query)
            return new Response("Missing query param 'q'", { status: 400 });
          const searchResults = await searchClubs(token, query);
          return new Response(JSON.stringify(searchResults), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let totalProcessed = 0;
        const results = [];
        const debugData: any[] = [];

        for (const club of CLUBS) {
          try {
            const { program: matches, raw } = await fetchClubProgram(
              token,
              club.id,
            );
            if (action === "debug")
              debugData.push({ club: club.name, raw: raw });

            const eventsToInsert = await Promise.all(
              matches.map(async (m: any) => {
                const home = m.homeTeamName || m.thuisteam || club.name;
                const away = m.awayTeamName || m.uitteam || "Tegenstander";
                const title = `${home} vs ${away}`;
                const date = m.dateTime || m.datum;

                if (!date) {
                  console.warn(
                    `[Sportlink] Match missing date: ${JSON.stringify(m)}`,
                  );
                  return null;
                }

                const contentHash = await generateHash(`${title}|${date}`);
                const fingerprint = await generateHash(
                  `${title}|${date}|${club.sourceId}`,
                );

                const imageUrl = m.homeTeamLogoUrl
                  ? `${supabaseUrl}/functions/v1/sportlink-ingest?action=logo&url=${encodeURIComponent(m.homeTeamLogoUrl)}`
                  : null;

                return {
                  title,
                  description: `Voetbalwedstrijd bij ${club.name}. ${home} speelt tegen ${away}.`,
                  event_date: date,
                  event_time: new Date(date).toLocaleTimeString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  category: "ACTIVE",
                  event_type: "anchor",
                  location: club.location,
                  venue_name: club.venueName,
                  source_id: club.sourceId,
                  content_hash: contentHash,
                  event_fingerprint: fingerprint,
                  status: "active",
                  image_url: imageUrl,
                  source_url: club.sourceUrl,
                };
              }),
            );

            const validEvents = eventsToInsert.filter(Boolean);
            if (validEvents.length > 0) {
              console.log(
                `[Sportlink] Upserting ${validEvents.length} events for ${club.name}...`,
              );
              const { data, error } = await supabase
                .from("events")
                .upsert(validEvents, { onConflict: "event_fingerprint" })
                .select("id");

              if (error) {
                console.error(
                  `[Sportlink] Upsert failed for ${club.name}: ${error.message}`,
                );
                await logSupabaseError(
                  "sportlink-ingest",
                  "ingest",
                  `Upsert for ${club.name}`,
                  error,
                );
              } else {
                totalProcessed += data?.length || 0;
                results.push({ club: club.name, count: data?.length });
              }
            }
          } catch (err: any) {
            console.error(
              `[Sportlink] Failed to process club ${club.name}:`,
              err,
            );
            await logSupabaseError(
              "sportlink-ingest",
              "ingest",
              `Loop for ${club.name}`,
              err,
            );
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            totalProcessed,
            results,
            debug: action === "debug" ? debugData : undefined,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (action === "logo") {
        const logoUrl = url.searchParams.get("url");
        if (!logoUrl)
          return new Response("Missing logo URL", {
            status: 400,
            headers: corsHeaders,
          });

        const response = await fetch(logoUrl);
        if (!response.ok)
          return new Response("Failed to fetch", {
            status: response.status,
            headers: corsHeaders,
          });

        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": response.headers.get("Content-Type") || "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    },
    { method: req.method, url: req.url },
  );
});
