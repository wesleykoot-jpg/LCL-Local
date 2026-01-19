

async function main() {
  // Try to load .env file
  const env: Record<string, string> = {};
  try {
    const text = await Deno.readTextFile(".env");
    for (const line of text.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        env[match[1]] = value;
      }
    }
  } catch (_e) {
    console.log("⚠️ Could not read .env file, relying on process env");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || env["VITE_SUPABASE_URL"];
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or Key (checked VITE_SUPABASE_PUBLISHABLE_KEY)");
    Deno.exit(1);
  }

  console.log(`Using Supabase URL: ${supabaseUrl}`);
  console.log(`Using Key: ${supabaseKey.slice(0, 10)}...`);

  const functionUrl = `${supabaseUrl}/functions/v1/scrape-coordinator`;
  console.log(`Triggering Coordinator at: ${functionUrl}`);

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        triggerWorker: true,
      }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}:`, data);
      Deno.exit(1);
    }

    console.log("✅ Coordinator triggered successfully!");
    console.log("Response:", JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("❌ Error triggering pipeline:", error);
    Deno.exit(1);
  }
}

main();
