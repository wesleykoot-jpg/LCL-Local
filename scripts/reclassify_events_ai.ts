
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import OpenAI from 'npm:openai@4.28.0';

// Configuration
const BATCH_SIZE = 10; 
const DRY_RUN = Deno.args.includes('--dry-run');

// Valid Categories from Enum
const VALID_CATEGORIES = [
  'MUSIC', 'SOCIAL', 'ACTIVE', 'CULTURE', 'FOOD', 
  'NIGHTLIFE', 'FAMILY', 'CIVIC', 'COMMUNITY'
];

async function main() {
  console.log(`Starting Event Reclassification (DRY_RUN: ${DRY_RUN})...`);

  // 1. Load Environment
  const envText = await Deno.readTextFile('.env');
  const env: Record<string, string> = {};
  envText.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
  });

  if (!env['SUPABASE_URL'] || !env['SUPABASE_SERVICE_ROLE_KEY'] || !env['OPENAI_API_KEY']) {
    console.error('Missing required environment variables');
    Deno.exit(1);
  }

  // 2. Initialize Clients
  const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
  const openai = new OpenAI({ apiKey: env['OPENAI_API_KEY'] });

  // 3. Fetch All Events (Pagination)
  let allEvents: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  
  console.log('Fetching all events...');
  while (true) {
    const { data: pageData, error } = await supabase
        .from('events')
        .select('id, title, description, venue_name, category')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
        console.error('Error fetching page', page, error);
        break;
    }
    if (!pageData || pageData.length === 0) break;
    
    allEvents.push(...pageData);
    console.log(`Visited page ${page}, total events fetched: ${allEvents.length}`);
    page++;
  }

  if (DRY_RUN) {
    console.log('DRY RUN: limiting to first 50 events');
    allEvents = allEvents.slice(0, 50);
  }

  console.log(`Total events to process: ${allEvents.length}`);

  // 4. Process in Batches
  let totalChanges = 0;
  let processedCount = 0;

  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE);
    processedCount += batch.length;
    console.log(`\nProcessing batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(allEvents.length / BATCH_SIZE)} (${batch.length} events)...`);

    const prompt = `
      You are an event classifier for a local community app.
      Classify the following events into exactly one of these categories:
      ${VALID_CATEGORIES.join(', ')}

      Rules:
      - MUSIC: Concerts, live bands, DJ sets.
      - NIGHTLIFE: Club nights, parties, late night.
      - FOOD: Dining, markets, tastings.
      - CULTURE: Theater, cinema, art, exhibitions, workshops, gaming.
      - ACTIVE: Sports, yoga, hiking, walks.
      - FAMILY: Kids events, parenting activities.
      - SOCIAL: Meetups, networking, drinks.
      - CIVIC: Council meetings, political events.
      - COMMUNITY: General gatherings, charity, religious, or if unsure.

      Return a JSON object where keys are the event IDs and values are the category strings.
      Example: { "uuid-1": "MUSIC", "uuid-2": "CULTURE" }

      Events to classify:
      ${JSON.stringify(batch.map(e => ({
        id: e.id,
        title: e.title,
        description: (e.description || '').substring(0, 200), // Truncate
        venue: e.venue_name
      })))}
    `;

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) continue;

      let classifications;
      try {
        classifications = JSON.parse(responseContent);
      } catch (e) {
        console.error('Error parsing OpenAI response:', e);
        continue;
      }

      const updates = [];
      for (const event of batch) {
        const newCategory = classifications[event.id];
        const oldCategory = event.category;

        if (!newCategory) {
            console.warn(`[WARN] No classification for ${event.id} (${event.title})`);
            continue;
        }

        if (!VALID_CATEGORIES.includes(newCategory)) {
          console.warn(`[WARN] Invalid category '${newCategory}' for '${event.title}'`);
          continue;
        }

        if (newCategory !== oldCategory) {
          totalChanges++;
          console.log(`[CHANGE] ${event.title}: ${oldCategory} -> ${newCategory}`);
          
          if (!DRY_RUN) {
             updates.push(
               (async () => {
                 for(let retry=0; retry<3; retry++) {
                    const { error: updateError } = await supabase
                      .from('events')
                      .update({ category: newCategory })
                      .eq('id', event.id);
                      
                    if (!updateError) return;
                    console.error(`Failed to update ${event.id} (attempt ${retry+1}):`, updateError.message);
                    await new Promise(r => setTimeout(r, 1000 * (retry + 1))); 
                 }
               })()
             );
          }
        }
      }
      
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (err) {
      console.error('Error processing batch:', err);
    }
    
    // Delay to check flow
    if (!DRY_RUN) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nReclassification Complete.`);
  console.log(`Total Events Processed: ${allEvents.length}`);
  console.log(`Total Changes Made: ${totalChanges}`);
}

main();
