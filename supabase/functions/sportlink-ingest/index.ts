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
const SPORTLINK_USER = "rxxnrextolzwlqsspy@hthlm.com";
const SPORTLINK_PASS = "test1234";

const SPORTLINK_AUTH_URL = "https://data.sportlink.com/oauth/token";
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
  params.append("client_secret", SPORTLINK_CLIENT_SECRET);
  params.append("username", SPORTLINK_USER);
  params.append("password", SPORTLINK_PASS);
  params.append("scope", "all");

  console.log(`[Sportlink] Requesting token for user ${SPORTLINK_USER}...`);
  const response = await fetch(SPORTLINK_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
  console.log(`[Sportlink] Token received successfully.`);
  return data.access_token;
}

async function fetchClubProgram(accessToken: string, clubId: string) {
  const now = new Date();
  const fromDate = now.toISOString().split("T")[0];
  const toDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]; // +60 days

  const url = `${SPORTLINK_API_BASE}/api/v1/club/program?client_id=${SPORTLINK_CLIENT_ID}&clubId=${clubId}&fromDate=${fromDate}&toDate=${toDate}`;
  console.log(
    `[Sportlink] Fetching program for club ${clubId} from ${fromDate} to ${toDate}...`,
  );
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[Sportlink] Program fetch failed for ${clubId}: ${response.status} ${errorBody}`,
    );
    await logHttpError(
      "sportlink-ingest",
      "fetchClubProgram",
      "Fetch Club Program",
      url,
      response.status,
      errorBody,
    );
    return [];
  }

  const rawData = await response.json();
  console.log(
    `[Sportlink] Raw response from ${clubId}:`,
    JSON.stringify(rawData).substring(0, 500),
  );

  const program = Array.isArray(rawData)
    ? rawData
    : rawData.program || rawData.wedstrijden || [];
  console.log(
    `[Sportlink] Received ${program.length} items for club ${clubId}.`,
  );
  return program;
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

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (action === "ingest" || action === "debug") {
        const token = await getAccessToken();
        let totalProcessed = 0;
        const results = [];
        const debugData: any[] = [];

        for (const club of CLUBS) {
          try {
            const matches = await fetchClubProgram(token, club.id);
            if (action === "debug")
              debugData.push({ club: club.name, raw: matches });

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
