import { assert, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";

import { enrichWithSocialFive } from "../supabase/functions/_shared/enrichmentService.ts";
import { analyzeSource } from "../supabase/functions/_shared/analyzerAgent.ts";
import { classifyVibeFromCategory } from "../supabase/functions/_shared/vibeClassifier.ts";

Deno.test("Waterfall v2 - enrichment + analyzer end-to-end (rules-only)", async () => {
  // Load sample HTML (use an existing sample in repo)
  const samplePath = new URL("../meppel_source.html", import.meta.url).pathname;
  const html = await Deno.readTextFile(samplePath);
  
  // Analyzer
  const analysis = analyzeSource(html);
  assertExists(analysis);
  console.log("Analyzer recommended fetcher:", analysis.recommended_fetcher, "confidence:", analysis.confidence);

  // Enrichment - use rulesOnly to avoid external AI calls
  const apiKey = ""; // not needed for rulesOnly
  const enrichment = await enrichWithSocialFive(apiKey, {
    detailHtml: html,
    baseUrl: "https://example.com/meppel",
    hints: { title: "Sample Event", date: "Unknown", location: "Meppel" },
    rulesOnly: true
  }, fetch);

  console.log("Enrichment result:", enrichment);

  assert(enrichment.success === true || enrichment.event !== null, "Enrichment should return an event or success");
  if (enrichment.event) {
    // Basic checks on Social Five fields produced by rules fallback
    assertExists(enrichment.event.title);
    assertExists(enrichment.event.event_date || enrichment.event.start_time);
    console.log("Extracted title:", enrichment.event.title);
  }

  // Vibe classification from category hint
  const vibe = classifyVibeFromCategory("CULTURE", html);
  assertExists(vibe.interaction_mode);
  console.log("Vibe interaction mode:", vibe.interaction_mode);

});
