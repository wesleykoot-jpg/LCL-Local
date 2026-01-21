import { isProbableEvent } from './supabase/functions/_shared/categorizer.ts';

const testCases = [
  { title: "Reactie op Oudejaarsconference 2025 – Perspectief door Dan", expected: false },
  { title: "Comment on: Nightlife in Groningen", expected: false },
  { title: "RE: Upcoming Workshop", expected: false },
  { title: "Techno Night at OOST", expected: true },
  { title: "Yoga in the Park", expected: true },
  { title: "Admin", expected: false },
  { title: "Hi", expected: false },
  { title: "A genuine event title that is long enough", expected: true }
];

console.log("Running Noise Filter Tests...\n");

let passed = 0;
testCases.forEach((tc, i) => {
  const result = isProbableEvent(tc.title);
  const isOk = result === tc.expected;
  if (isOk) passed++;
  
  console.log(`${isOk ? '✅' : '❌'} Case ${i + 1}: "${tc.title}"`);
  console.log(`   Expected: ${tc.expected}, Got: ${result}\n`);
});

console.log(`Summary: ${passed}/${testCases.length} passed.`);

if (passed === testCases.length) {
  console.log("All noise filter tests passed!");
} else {
  console.log("Some tests failed.");
  Deno.exit(1);
}
