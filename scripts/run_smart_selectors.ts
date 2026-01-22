import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { createFetcherForSource } from "../supabase/functions/_shared/strategies.ts";

// Helper to load .env manually
try {
  const text = await Deno.readTextFile(".env");
  for (const line of text.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1);
      Deno.env.set(match[1], value);
    }
  }
} catch (e) {
  console.log("⚠️ .env load failed or not found");
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error("Missing Keys (Supabase or OpenAI)");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runSmartSelectors() {
  console.log("Fetching failing sources for Smart Selector generation...");

  // Find sources that are enabled but failing (no recent scrape success or 0 consecutive successes)
  // Limit to small batch to save tokens
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("*")
    .eq("enabled", true)
    .or("total_events_scraped.eq.0,consecutive_failures.gt.0")
    // .is("config->selectors", null) // Removed debug
    .limit(5);

  if (error || !sources) {
    console.error("Failed to fetch sources:", error);
    Deno.exit(1);
  }

  console.log(`Analyzing ${sources.length} failing sources...`);

  for (const source of sources) {
    console.log(`\n🔍 Analyzing ${source.name} (${source.url})...`);

    try {
      // 1. Fetch HTML
      const fetcher = createFetcherForSource(source);
      const { html, statusCode } = await fetcher.fetchPage(source.url);

      if (statusCode >= 400 || html.length < 500) {
        console.log(
          `   ❌ Page fetch failed (${statusCode}) or empty. Skipping.`,
        );
        continue;
      }

      // 2. Ask AI for Selectors
      console.log(`   🤖 Asking AI to find selectors...`);
      const selectors = await askAiForSelectors(html, source.url);

      if (selectors && selectors.length > 0) {
        console.log(`   ✅ AI found selectors: ${JSON.stringify(selectors)}`);

        // 3. Update DB
        const newConfig = {
          ...source.config,
          selectors: selectors,
        };

        await supabase
          .from("scraper_sources")
          .update({ config: newConfig, consecutive_failures: 0 }) // Reset failures so it tries again
          .eq("id", source.id);

        console.log(`   💾 Saved to config!`);
      } else {
        console.log(`   ⚠️ AI could not find obvious event selectors.`);
      }

      // 4. Iframe Check (Solution 3 implicit)
      if (html.includes("<iframe")) {
        console.log(
          `   ⚠️ Iframe detected. Checking if we can extract inner URL...`,
        );
        const iframeMatch = html.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (
          iframeMatch &&
          (iframeMatch[1].includes("calendar") ||
            iframeMatch[1].includes("agenda"))
        ) {
          console.log(`   ✅ Found Calendar Iframe: ${iframeMatch[1]}`);
          // Note: Updating the URL is risky without human review, logging for now or we could add 'alternatePaths'
        }
      }
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
  }
}

async function askAiForSelectors(
  html: string,
  url: string,
): Promise<string[] | null> {
  // Truncate HTML to save tokens (head + body start)
  const truncated = html.substring(0, 30000);

  const prompt = `
    You are an expert web scraper. Analyze this HTML snippet from ${url}.
    Identify the CSS selector that uniquely matches the *individual event cards* or *list items* in the main agenda/calendar list.
    
    Rules:
    1. Return ONLY a JSON array of strings, e.g. ["div.event-item", "article.card"].
    2. Prefer specific classes over generic tags (like 'div').
    3. Do not include markdown formatting.
    4. If no clear list is found, return null.

    HTML:
    ${truncated}
    `;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Fast & Cheap
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });

    const data = await res.json();
    const content = data.choices[0].message.content.trim();

    // Clean markdown
    const clean = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("AI API Error:", e);
    return null;
  }
}

runSmartSelectors();
