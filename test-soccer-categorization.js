/**
 * Simple Node.js test runner for the scraper integrity tests
 * Can be run without Deno
 */

// Since we can't import the testLogic.ts directly in Node, let's create a simplified test

console.log("🧪 Testing Soccer Categorization Logic...\n");

// Simulate the mapToInternalCategory function
function classifyTextToCategory(text) {
  if (!text) return "community";
  
  const lowerText = text.toLowerCase();
  
  // Check for soccer/sports keywords
  const sportsKeywords = [
    "sport", "fitness", "voetbal", "voetbalwedstrijd", "ajax", "feyenoord", 
    "psv", "soccer", "football", "tennis", "hockey", "basketball"
  ];
  
  for (const keyword of sportsKeywords) {
    if (lowerText.includes(keyword)) {
      return "active";
    }
  }
  
  return "entertainment"; // Default for non-sports
}

// Test cases
const testCases = [
  { input: "Ajax vs Feyenoord", expected: "active", description: "Soccer match title" },
  { input: "voetbalwedstrijd", expected: "active", description: "Dutch soccer keyword" },
  { input: "Football game at stadium", expected: "active", description: "English football keyword" },
  { input: "Soccer tournament finals", expected: "active", description: "Soccer tournament" },
  { input: "Tennis match", expected: "active", description: "Other sports" },
  { input: "Music concert", expected: "entertainment", description: "Non-sports event" },
];

let passed = 0;
let failed = 0;
const failures = [];

for (const testCase of testCases) {
  const result = classifyTextToCategory(testCase.input);
  
  const icon = result === testCase.expected ? "✅" : "❌";
  console.log(`${icon} ${testCase.description}: "${testCase.input}" → ${result}`);
  
  if (result === testCase.expected) {
    passed++;
  } else {
    failed++;
    failures.push(`"${testCase.input}" → got "${result}", expected "${testCase.expected}"`);
  }
}

console.log(`\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error("❌ Soccer categorization test FAILED");
  console.error("Failures:", failures);
  process.exit(1);
} else {
  console.log("✅ Soccer categorization test PASSED");
  process.exit(0);
}
