import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runScraperIntegrityTest } from "../supabase/functions/scrape-events/index.ts";

Deno.test("scraper integrity test suite passes", async () => {
  const report = await runScraperIntegrityTest();
  const failed = report.results.filter((result) => result.status !== "PASS");
  assert(report.results.length > 0, "Expected integrity test results");
  assert(
    failed.length === 0,
    `Integrity tests failed: ${failed.map((result) => `${result.test} (${result.details ?? "no details"})`).join("; ")}`
  );
});
