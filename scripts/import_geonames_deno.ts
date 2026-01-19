
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import AdmZip from "npm:adm-zip@0.5.10";
import { parse } from "https://deno.land/std@0.182.0/flags/mod.ts";

const GEONAMES_URL = "http://download.geonames.org/export/dump/cities15000.zip";
const TMP_DIR = "./tmp_geonames";
const ZIP_FILE = `${TMP_DIR}/cities15000.zip`;
const TXT_FILE = `${TMP_DIR}/cities15000.txt`;

// Supabase Setup
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadFile(url: string, dest: string) {
    console.log(`Downloading ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
    const fsFile = await Deno.open(dest, { create: true, write: true });
    await res.body?.pipeTo(fsFile.writable);
    console.log("Download complete.");
}

function mapTimezoneToContinent(tz: string): string {
    if (!tz) return "UNKNOWN";
    if (tz.startsWith("Europe/")) return "EU";
    if (tz.startsWith("Asia/")) return "AS";
    if (tz.startsWith("Africa/")) return "AF";
    if (tz.startsWith("Australia/")) return "OC";
    if (tz.startsWith("Pacific/")) return "OC";
    if (tz.startsWith("America/")) {
        // Crude split for NA/SA.
        // Better would be via Country Code mapping, but TZ is okay for approximation.
        // America/New_York -> NA. America/Argentina -> SA.
        // For now, return "AM" (Americas) or try to check country code?
        // We map country code in TS?
        // Let's rely on Country Code mapping if we had it.
        // I'll return "AM" for now, and rely on country code later if needed.
        return "AM";
    }
    if (tz.startsWith("Antarctica/")) return "AN";
    if (tz.startsWith("Indian/")) return "AS"; // mostly
    if (tz.startsWith("Atlantic/")) return "EU"; // mostly (Canary, Madeira) or NA (Bermuda).
    return "UNKNOWN";
}

async function main() {
    try {
        await Deno.mkdir(TMP_DIR, { recursive: true });

        // 1. Download
        if (1) { // Force download? Or check exists?
            await downloadFile(GEONAMES_URL, ZIP_FILE);
        }

        // 2. Unzip
        console.log("Unzipping...");
        const zip = new AdmZip(ZIP_FILE);
        zip.extractAllTo(TMP_DIR, true);
        console.log("Unzipped.");

        // 3. Parse
        console.log("Reading data...");
        const text = await Deno.readTextFile(TXT_FILE);
        const lines = text.split("\n");
        console.log(`Found ${lines.length} lines.`);

        const batchSize = 500;
        let batch = [];
        let count = 0;

        for (const line of lines) {
            if (!line.trim()) continue;
            // Format: geonameid, name, asciiname, alternatenames, lat, lon, feature class, feature code, country code, cc2, admin1 code, admin2 code, admin3 code, admin4 code, population, elevation, dem, timezone, modification date
            const cols = line.split("\t");

            const geonameId = parseInt(cols[0]);
            const name = cols[1];
            const lat = parseFloat(cols[4]);
            const lon = parseFloat(cols[5]);
            const countryCode = cols[8];
            const admin1Code = cols[10];
            const population = parseInt(cols[14]);
            const timezone = cols[17];

            const continent = mapTimezoneToContinent(timezone);

            // Determine priority tier
            // 1: Pop > 500k. 2: Pop > 100k. 3: Pop > 15k.
            let tier = 3;
            if (population > 500000) tier = 1;
            else if (population > 100000) tier = 2;

            batch.push({
                geoname_id: geonameId,
                name: name,
                country_code: countryCode,
                admin1_code: admin1Code,
                population: population,
                continent: continent,
                priority_tier: tier,
                last_discovery_at: null,
                discovery_status: 'pending',
                latitude: lat,
                longitude: lon,
                timezone: timezone
            });

            if (batch.length >= batchSize) {
                const { error } = await supabase.from("cities").upsert(batch, { onConflict: "geoname_id" });
                if (error) {
                    console.error("Batch insert error:", error);
                } else {
                    process.stdout.write(".");
                }
                count += batch.length;
                batch = [];
            }
        }

        if (batch.length > 0) {
            const { error } = await supabase.from("cities").upsert(batch, { onConflict: "geoname_id" });
            if (error) console.error("Final insert error:", error);
            count += batch.length;
        }

        console.log(`\nImport complete! Processed ${count} cities.`);

        // Cleanup
        // await Deno.remove(TMP_DIR, { recursive: true });

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
