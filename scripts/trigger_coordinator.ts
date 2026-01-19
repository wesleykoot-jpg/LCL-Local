
const FUNCTION_URL = "https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/source-discovery-coordinator";
const AUTH_TOKEN = "sbp_1cd79171059d66139d665f17b00f570d997da543";

async function main() {
    console.log("Triggering Coordinator...");
    const r = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ limit: 10, force: true })
    });
    console.log(`Status: ${r.status}`);
    console.log(await r.text());
}

main();
