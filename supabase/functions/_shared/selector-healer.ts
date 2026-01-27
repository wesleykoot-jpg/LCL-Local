/**
 * Selector Healer: Self-healing CSS selectors using AI
 * 
 * When extraction fails 3+ times, this module:
 * 1. Compares current HTML with last working version
 * 2. Asks GPT-4o to infer new selectors
 * 3. Validates new selectors before applying
 * 4. Logs healing attempts for auditing
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
export interface SelectorsConfig {
  eventList: string;           // Container selector for event list
  eventItem: string;           // Individual event item selector
  title: string;               // Title within event item
  date: string;                // Date selector
  time: string;                // Time selector
  location: string;            // Location/venue selector
  description: string;         // Description selector
  image: string;               // Image selector
  link: string;                // Link to detail page
  price?: string;              // Price selector (optional)
}

export interface HealingResult {
  success: boolean;
  oldSelectors: SelectorsConfig;
  newSelectors: SelectorsConfig;
  reasoning: string;
  eventsFoundBefore: number;
  eventsFoundAfter: number;
  applied: boolean;
}

export interface SourceHealth {
  sourceId: string;
  consecutiveFailures: number;
  lastWorkingSelectors: SelectorsConfig | null;
  currentSelectors: SelectorsConfig;
}

/**
 * Check if a source needs selector healing
 */
export async function needsHealing(
  supabase: ReturnType<typeof createClient>,
  sourceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('scraper_sources')
    .select('consecutive_failures, selectors_config')
    .eq('id', sourceId)
    .single();

  if (!data) return false;

  // Heal after 3+ consecutive failures
  return data.consecutive_failures >= 3;
}

/**
 * Get HTML versions for comparison
 */
async function getHtmlVersions(
  supabase: ReturnType<typeof createClient>,
  sourceId: string
): Promise<{ current: string; previous: string | null }> {
  const { data } = await supabase
    .from('raw_pages')
    .select('html, created_at')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (!data || data.length === 0) {
    throw new Error('No HTML versions available for healing');
  }

  return {
    current: data[0].html,
    previous: data[1]?.html || null,
  };
}

/**
 * Use AI to infer new selectors from changed HTML
 */
export async function inferNewSelectors(
  currentHtml: string,
  previousHtml: string | null,
  oldSelectors: SelectorsConfig,
  sourceUrl: string
): Promise<{ selectors: SelectorsConfig; reasoning: string }> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Truncate HTML for API limits
  const truncatedCurrent = currentHtml.slice(0, 20000);
  const truncatedPrevious = previousHtml?.slice(0, 10000) || 'N/A';

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert web scraping engineer. A website's HTML structure has changed and the old CSS selectors no longer work. Your job is to analyze the new HTML and provide updated selectors.

Old selectors that stopped working:
${JSON.stringify(oldSelectors, null, 2)}

Guidelines:
1. Look for event listing patterns (calendar grids, event cards, list items)
2. Prefer stable selectors: IDs > data attributes > semantic classes > positional
3. Avoid selectors with dynamic IDs, hashes, or session tokens
4. Use CSS pseudo-selectors like :first-child, :nth-child when helpful
5. Test mentally that selectors would match multiple events, not just one

Return updated selectors and explain what changed.`
        },
        {
          role: "user",
          content: `Source URL: ${sourceUrl}

Previous HTML (for comparison):
${truncatedPrevious}

Current HTML (extract new selectors from this):
${truncatedCurrent}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "selector_healing",
          strict: true,
          schema: {
            type: "object",
            properties: {
              selectors: {
                type: "object",
                properties: {
                  eventList: { type: "string", description: "Container for event list" },
                  eventItem: { type: "string", description: "Individual event item" },
                  title: { type: "string", description: "Event title within item" },
                  date: { type: "string", description: "Date selector" },
                  time: { type: "string", description: "Time selector" },
                  location: { type: "string", description: "Location/venue" },
                  description: { type: "string", description: "Description" },
                  image: { type: "string", description: "Image selector" },
                  link: { type: "string", description: "Detail page link" },
                  price: { type: "string", description: "Price selector" }
                },
                required: ["eventList", "eventItem", "title", "date", "time", "location", "description", "image", "link"],
                additionalProperties: false
              },
              reasoning: { 
                type: "string", 
                description: "Explanation of what changed and why new selectors should work" 
              },
              confidence: { 
                type: "number", 
                description: "Confidence score 0-1 that new selectors are correct" 
              }
            },
            required: ["selectors", "reasoning", "confidence"],
            additionalProperties: false
          }
        }
      },
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);

  return {
    selectors: result.selectors,
    reasoning: result.reasoning,
  };
}

/**
 * Validate selectors by counting matches in HTML
 */
export function validateSelectors(
  html: string,
  selectors: SelectorsConfig
): number {
  // Simple validation by looking for selector patterns in HTML
  // In a real implementation, you'd use a DOM parser

  // Count how many times the eventItem selector's key parts appear
  const itemSelector = selectors.eventItem;
  
  // Extract class or ID from selector
  const classMatch = itemSelector.match(/\.([a-zA-Z0-9_-]+)/);
  const idMatch = itemSelector.match(/#([a-zA-Z0-9_-]+)/);
  const tagMatch = itemSelector.match(/^([a-z]+)/i);

  let pattern: RegExp;
  if (classMatch) {
    pattern = new RegExp(`class="[^"]*${classMatch[1]}[^"]*"`, 'gi');
  } else if (idMatch) {
    pattern = new RegExp(`id="${idMatch[1]}"`, 'gi');
  } else if (tagMatch) {
    pattern = new RegExp(`<${tagMatch[1]}[\\s>]`, 'gi');
  } else {
    return 0;
  }

  const matches = html.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Main healing function
 */
export async function healSelectors(
  supabase: ReturnType<typeof createClient>,
  sourceId: string
): Promise<HealingResult> {
  // Get source config
  const { data: source } = await supabase
    .from('scraper_sources')
    .select('url, selectors_config, last_working_selectors')
    .eq('id', sourceId)
    .single();

  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }

  const oldSelectors = source.selectors_config as SelectorsConfig;
  const lastWorking = source.last_working_selectors as SelectorsConfig | null;

  // Get HTML versions
  const { current, previous } = await getHtmlVersions(supabase, sourceId);

  // Count events with old selectors
  const eventsFoundBefore = validateSelectors(current, oldSelectors);

  // Try AI inference
  let newSelectors: SelectorsConfig;
  let reasoning: string;

  try {
    const result = await inferNewSelectors(
      current,
      previous,
      oldSelectors,
      source.url
    );
    newSelectors = result.selectors;
    reasoning = result.reasoning;
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      // Queue for later
      await queueHealingJob(supabase, sourceId, 50);
      throw error;
    }
    throw error;
  }

  // Validate new selectors
  const eventsFoundAfter = validateSelectors(current, newSelectors);

  // Only apply if new selectors find more events
  const shouldApply = eventsFoundAfter > eventsFoundBefore && eventsFoundAfter >= 3;

  // Log the healing attempt
  await supabase.from('selector_healing_log').insert({
    source_id: sourceId,
    old_selectors: oldSelectors,
    new_selectors: newSelectors,
    ai_reasoning: reasoning,
    test_successful: shouldApply,
    events_extracted_before: eventsFoundBefore,
    events_extracted_after: eventsFoundAfter,
    applied_at: shouldApply ? new Date().toISOString() : null,
  });

  // Apply new selectors if successful
  if (shouldApply) {
    await supabase
      .from('scraper_sources')
      .update({
        selectors_config: newSelectors,
        last_working_selectors: oldSelectors, // Backup old ones
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId);
  }

  return {
    success: shouldApply,
    oldSelectors,
    newSelectors,
    reasoning,
    eventsFoundBefore,
    eventsFoundAfter,
    applied: shouldApply,
  };
}

/**
 * Revert to last working selectors
 */
export async function revertSelectors(
  supabase: ReturnType<typeof createClient>,
  sourceId: string
): Promise<boolean> {
  const { data: source } = await supabase
    .from('scraper_sources')
    .select('selectors_config, last_working_selectors')
    .eq('id', sourceId)
    .single();

  if (!source?.last_working_selectors) {
    return false;
  }

  // Swap current and last working
  await supabase
    .from('scraper_sources')
    .update({
      selectors_config: source.last_working_selectors,
      last_working_selectors: source.selectors_config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId);

  // Log the revert
  await supabase.from('selector_healing_log').insert({
    source_id: sourceId,
    old_selectors: source.selectors_config,
    new_selectors: source.last_working_selectors,
    ai_reasoning: 'Manual revert to last working selectors',
    reverted_at: new Date().toISOString(),
  });

  return true;
}

/**
 * Queue healing job for later processing
 */
export async function queueHealingJob(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  priority: number = 100
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_job_queue')
    .insert({
      job_type: 'heal_selectors',
      related_id: sourceId,
      payload: { sourceId },
      priority,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Get healing history for a source
 */
export async function getHealingHistory(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  created_at: string;
  test_successful: boolean;
  events_extracted_before: number;
  events_extracted_after: number;
  applied_at: string | null;
  reverted_at: string | null;
}>> {
  const { data, error } = await supabase
    .from('selector_healing_log')
    .select('id, created_at, test_successful, events_extracted_before, events_extracted_after, applied_at, reverted_at')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
