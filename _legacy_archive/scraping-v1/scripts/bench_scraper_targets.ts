import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const TARGETS = [
  { name: "Visit Zwolle", url: "https://visitzwolle.com/agenda" },
  { name: "InZwolle", url: "https://www.inzwolle.nl/agenda" },
];

async function bench() {
  for (const t of TARGETS) {
    console.log(`\nTesting ${t.name} (${t.url})...`);
    const start = performance.now();
    try {
      const res = await fetch(t.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
      });
      const fetchTime = performance.now() - start;
      console.log(`Fetch Status: ${res.status}`);
      console.log(`Fetch Time: ${fetchTime.toFixed(2)}ms`);

      const html = await res.text();
      const textTime = performance.now() - start - fetchTime;
      console.log(`HTML Size: ${(html.length / 1024).toFixed(2)} KB`);
      console.log(`Text Read Time: ${textTime.toFixed(2)}ms`);

      const parseStart = performance.now();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const parseTime = performance.now() - parseStart;
      console.log(`DOM Parse Time: ${parseTime.toFixed(2)}ms`);

      if (!doc) console.error("DOM Parse Failed");
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
  }
}

bench();
