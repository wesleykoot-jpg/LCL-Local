/**
 * Comprehensive E2E test suite for the event scraper.
 * 
 * Tests the exact same logic that runs when the Admin UI button is clicked.
 * 
 * Run with: deno test tests/scraper_e2e_comprehensive_test.ts
 */

import { runScraperIntegrityTest } from "../supabase/functions/scrape-events/testLogic.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Scraper Integrity Test Suite - All Tests", async () => {
  console.log("\n🧪 Running comprehensive scraper integrity tests...\n");
  
  const report = await runScraperIntegrityTest();
  
  // Log results
  console.log(`📊 Test Results (${report.timestamp}):`);
  console.log(`   Total: ${report.summary.total}`);
  console.log(`   ✅ Passed: ${report.summary.passed}`);
  console.log(`   ❌ Failed: ${report.summary.failed}\n`);
  
  // Log individual test results
  for (const result of report.results) {
    const icon = result.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${result.test}: ${result.status}`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
    if (result.details && result.status === "FAIL") {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
  }
  
  console.log("\n");
  
  // Assert all tests passed
  assertEquals(report.success, true, `Expected all tests to pass, but ${report.summary.failed} failed`);
  assert(report.summary.passed === report.summary.total, 
    `Expected ${report.summary.total} tests to pass, but only ${report.summary.passed} passed`);
});

Deno.test("Soccer Categorization Test - Standalone", async () => {
  const { testSoccerCategorization } = await import("../supabase/functions/scrape-events/testLogic.ts");
  const result = await testSoccerCategorization();
  
  console.log(`\n⚽ Soccer Categorization: ${result.status}`);
  if (result.message) console.log(`   ${result.message}`);
  
  assertEquals(result.status, "PASS", result.message || "Soccer categorization failed");
});

Deno.test("Failover Strategy Test - Standalone", async () => {
  const { testFailoverStrategy } = await import("../supabase/functions/scrape-events/testLogic.ts");
  const result = await testFailoverStrategy();
  
  console.log(`\n🔄 Failover Strategy: ${result.status}`);
  if (result.message) console.log(`   ${result.message}`);
  
  assertEquals(result.status, "PASS", result.message || "Failover strategy failed");
});

Deno.test("Rate Limiting Handling Test - Standalone", async () => {
  const { testRateLimitingHandling } = await import("../supabase/functions/scrape-events/testLogic.ts");
  const result = await testRateLimitingHandling();
  
  console.log(`\n⏱️  Rate Limiting: ${result.status}`);
  if (result.message) console.log(`   ${result.message}`);
  
  assertEquals(result.status, "PASS", result.message || "Rate limiting handling failed");
});

Deno.test("404 Handling Test - Standalone", async () => {
  const { test404Handling } = await import("../supabase/functions/scrape-events/testLogic.ts");
  const result = await test404Handling();
  
  console.log(`\n🔍 404 Handling: ${result.status}`);
  if (result.message) console.log(`   ${result.message}`);
  
  assertEquals(result.status, "PASS", result.message || "404 handling failed");
});

Deno.test("Time Parsing Test - Standalone", async () => {
  const { testTimeParsing } = await import("../supabase/functions/scrape-events/testLogic.ts");
  const result = await testTimeParsing();
  
  console.log(`\n🕐 Time Parsing: ${result.status}`);
  if (result.message) console.log(`   ${result.message}`);
  
  assertEquals(result.status, "PASS", result.message || "Time parsing failed");
});

Deno.test("Idempotency Test - Standalone", async () => {
  const { testIdempotency } = await import("../supabase/functions/scrape-events/testLogic.ts");
  const result = await testIdempotency();
  
  console.log(`\n🔐 Idempotency: ${result.status}`);
  if (result.message) console.log(`   ${result.message}`);
  
  assertEquals(result.status, "PASS", result.message || "Idempotency test failed");
});
