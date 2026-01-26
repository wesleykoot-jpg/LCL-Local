
import { parseToISODate } from "../supabase/functions/_shared/dateUtils.ts";

const testCases = [
    "7 feb 2026\n\nAanvang: 20:15\n\nLeeuwarden",
    "wo 21 jan 2026",
    "vrijdag 13 februari 2026",
    "2026-02-07T20:15:00Z",
    "12 apr 2026",
    "ma 24 mrt",
    "ma 24 mrt 2026",
    "8. juli 2026",
    "  \n  15 mei 2026  \n  "
];

console.log("🧪 Testing Date Parsing Logic...");
for (const tc of testCases) {
    const cleaned = tc.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    const result = parseToISODate(cleaned);
    console.log(`Input: "${tc.replace(/\n/g, '\\n')}"`);
    console.log(`Cleaned: "${cleaned}"`);
    console.log(`Result: ${result}`);
    console.log("-".repeat(20));
}
