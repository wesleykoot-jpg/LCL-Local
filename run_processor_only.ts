// run_processor_only.ts
import { handler as processorHandler } from "./supabase/functions/process-events/index.ts";

async function main() {
  console.log("--- Running Data‑First processor only ---");
  const req = new Request("http://localhost/processor", { method: "POST" });
  const res = await processorHandler(req);
  const txt = await res.text();
  console.log("Processor response:", txt);
}

main().catch((e) => console.error("Processor error", e));
