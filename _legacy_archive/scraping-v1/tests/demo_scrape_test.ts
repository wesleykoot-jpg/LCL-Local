import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCandidateUrls, computeDedupHash, normalizeLocationForHash } from "../demo_scrape.ts";

Deno.test("buildCandidateUrls adds canonical paths and deduplicates", () => {
  const urls = buildCandidateUrls("https://example.com/agenda");
  assert(urls.includes("https://example.com/agenda"));
  assert(urls.includes("https://example.com/agenda/"));
  assert(urls.includes("https://example.com/evenementen"));
  assertEquals(new Set(urls).size, urls.length);
});

Deno.test("computeDedupHash normalizes location", async () => {
  const h1 = await computeDedupHash("Title", "2026-07-13", "Town Hall!");
  const h2 = await computeDedupHash("title", "2026-07-13", "town-hall");
  assertEquals(h1, h2);
});

Deno.test("normalizeLocationForHash strips punctuation", () => {
  assertEquals(normalizeLocationForHash("De Koepel, Zwolle"), "dekoepelzwolle");
});
