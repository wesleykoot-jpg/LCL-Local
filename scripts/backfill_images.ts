import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function resolveUrl(baseUrl: string, maybeUrl: string): string {
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return maybeUrl;
  }
}

function isLikelyTrackingUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  return (
    lowered.includes("facebook.com/tr") ||
    lowered.includes("doubleclick") ||
    lowered.includes("googletagmanager") ||
    lowered.includes("google-analytics") ||
    lowered.includes("analytics") ||
    lowered.includes("pixel") ||
    lowered.includes("adsystem")
  );
}

function isLikelyImageUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  if (isLikelyTrackingUrl(lowered)) return false;
  return (
    lowered.endsWith(".jpg") ||
    lowered.endsWith(".jpeg") ||
    lowered.endsWith(".png") ||
    lowered.endsWith(".webp") ||
    lowered.endsWith(".gif") ||
    lowered.includes("image") ||
    lowered.includes("img")
  );
}

function extractImageUrlFromHtml(html: string, sourceUrl: string): string | null {
  const metaMatches = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ];

  for (const regex of metaMatches) {
    const match = html.match(regex);
    if (match?.[1]) {
      const candidate = resolveUrl(sourceUrl, match[1]);
      if (isLikelyImageUrl(candidate)) {
        return candidate;
      }
    }
  }

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch?.[1]) {
    const candidate = resolveUrl(sourceUrl, imgMatch[1]);
    return isLikelyImageUrl(candidate) ? candidate : null;
  }

  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,nl;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const { data: rows } = await supabase
  .from("events")
  .select("id, source_url, image_url")
  .not("source_url", "is", null)
  .limit(50);

let updated = 0;
let attempted = 0;

for (const row of rows || []) {
  attempted++;
  const sourceUrl = row.source_url as string;
  const currentImage = (row.image_url as string | null) || "";
  const shouldReplace =
    currentImage.length === 0 ||
    currentImage.toLowerCase().includes("facebook.com/tr") ||
    currentImage.toLowerCase().includes("doubleclick") ||
    currentImage.toLowerCase().includes("googletagmanager") ||
    currentImage.toLowerCase().includes("google-analytics") ||
    currentImage.toLowerCase().includes("analytics") ||
    currentImage.toLowerCase().includes("pixel");

  if (!shouldReplace) continue;
  const html = await fetchHtml(sourceUrl);
  if (!html) continue;
  const imageUrl = extractImageUrlFromHtml(html, sourceUrl);
  if (!imageUrl) continue;

  const { error } = await supabase
    .from("events")
    .update({ image_url: imageUrl })
    .eq("id", row.id);

  if (!error) updated++;

  await new Promise((r) => setTimeout(r, 300));
}

console.log(`Attempted: ${attempted}, updated: ${updated}`);
