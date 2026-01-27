import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runSampleScraperSuite } from "../run-scraper-sample-test.ts";

Deno.test("sample scraper suite produces parsed events", async () => {
  const { summary, results } = await runSampleScraperSuite({ limitSources: 1, writeReport: false });
  assert(summary.totalSources >= 1);
  assert(results.length >= 1);
  assert(results[0].parsedCount >= 1);
});
