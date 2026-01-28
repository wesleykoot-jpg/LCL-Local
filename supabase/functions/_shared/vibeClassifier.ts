/**
 * Vibe Classifier Agent
 * 
 * AI Injection Point: "Vibe Classifier"
 * 
 * Infers interaction_mode from event category and description.
 * This is a Tier 3 extraction that adds the "vibe" dimension to events.
 * 
 * Interaction Modes:
 * - high: Workshops, networking, meetups (lots of talking to strangers)
 * - medium: Concerts, markets, festivals (some interaction)
 * - low: Talks, lectures, presentations (mostly listening)
 * - passive: Movies, exhibitions, theater (no interaction expected)
 * 
 * @module _shared/vibeClassifier
 */

// ============================================================================
// TYPES
// ============================================================================

export type InteractionMode = 'high' | 'medium' | 'low' | 'passive';

export interface VibeClassification {
  interaction_mode: InteractionMode;
  confidence: number;
  persona_tags: string[];
  reasoning?: string;
}

// ============================================================================
// CATEGORY-BASED CLASSIFICATION RULES
// ============================================================================

interface CategoryRule {
  patterns: RegExp[];
  mode: InteractionMode;
  confidence: number;
  tags: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  // HIGH INTERACTION - Workshops, networking, meetups
  {
    patterns: [
      /workshop/i,
      /masterclass/i,
      /cursus/i,
      /les\b/i,
      /training/i,
      /netwerk/i,
      /network/i,
      /meetup/i,
      /meet-up/i,
      /borrel/i,
      /drinks?/i,
      /social\s+event/i,
      /speed\s*dat/i,
      /pub\s*quiz/i,
      /trivia/i,
      /game\s*night/i,
      /spel/i,
      /karaoke/i,
      /dance\s*class/i,
      /dansles/i,
      /yoga/i,
      /fitness/i,
      /wandel/i,
      /walk/i,
      /tour\b/i,
      /rondleiding/i,
      /proeverij/i,
      /tasting/i
    ],
    mode: 'high',
    confidence: 0.85,
    tags: ['NightOwl', 'Curious']
  },
  
  // MEDIUM INTERACTION - Concerts, markets, festivals
  {
    patterns: [
      /concert/i,
      /festival/i,
      /markt/i,
      /market/i,
      /fair\b/i,
      /beurs/i,
      /braderie/i,
      /open\s*dag/i,
      /open\s*day/i,
      /feest/i,
      /party/i,
      /club/i,
      /disco/i,
      /dj\s*set/i,
      /live\s*music/i,
      /live\s*muziek/i,
      /dans/i,
      /dance/i,
      /sport/i,
      /wedstrijd/i,
      /match/i,
      /race/i,
      /run\b/i,
      /loop\b/i,
      /carnaval/i,
      /kermis/i,
      /pride/i,
      /parade/i
    ],
    mode: 'medium',
    confidence: 0.80,
    tags: ['NightOwl', 'FamilyFriendly']
  },
  
  // LOW INTERACTION - Talks, lectures, presentations
  {
    patterns: [
      /lezing/i,
      /lecture/i,
      /talk\b/i,
      /presentatie/i,
      /presentation/i,
      /seminar/i,
      /symposium/i,
      /conferentie/i,
      /conference/i,
      /debat/i,
      /debate/i,
      /discussie/i,
      /panel/i,
      /q\s*&\s*a/i,
      /signing/i,
      /meet\s*&\s*greet/i,
      /boek/i,
      /book\s*launch/i,
      /reading/i,
      /voorlees/i,
      /interview/i
    ],
    mode: 'low',
    confidence: 0.80,
    tags: ['Curious', 'CultureVulture']
  },
  
  // PASSIVE - Movies, exhibitions, theater
  {
    patterns: [
      /film\b/i,
      /movie/i,
      /bioscoop/i,
      /cinema/i,
      /screening/i,
      /vertoning/i,
      /theater/i,
      /theatre/i,
      /toneel/i,
      /musical/i,
      /opera/i,
      /ballet/i,
      /dans\s*voorstelling/i,
      /show\b/i,
      /voorstelling/i,
      /performance/i,
      /expositie/i,
      /exhibition/i,
      /tentoonstelling/i,
      /museum/i,
      /galerie/i,
      /gallery/i,
      /stand-up/i,
      /comedy/i,
      /cabaret/i
    ],
    mode: 'passive',
    confidence: 0.85,
    tags: ['CultureVulture', 'DateNight']
  }
];

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Classify interaction mode based on category and description
 */
export function classifyVibe(
  category: string,
  description: string
): VibeClassification {
  const combinedText = `${category} ${description}`.toLowerCase();
  
  // Check rules in order of specificity
  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(combinedText)) {
        return {
          interaction_mode: rule.mode,
          confidence: rule.confidence,
          persona_tags: rule.tags,
          reasoning: `Matched pattern: ${pattern.source}`
        };
      }
    }
  }
  
  // Fallback classification based on category hint
  return classifyByGenericCategory(category);
}

/**
 * Quick classification from category only (for enrichment fallback)
 */
export function classifyVibeFromCategory(
  category: string,
  description: string = ''
): VibeClassification {
  return classifyVibe(category, description);
}

// ============================================================================
// CATEGORY MAPPING
// ============================================================================

const CATEGORY_MODE_MAP: Record<string, { mode: InteractionMode; tags: string[] }> = {
  // High interaction categories
  'WORKSHOP': { mode: 'high', tags: ['Curious'] },
  'NETWORKING': { mode: 'high', tags: ['NightOwl'] },
  'MEETUP': { mode: 'high', tags: ['NightOwl'] },
  'SPORTS': { mode: 'medium', tags: ['FamilyFriendly'] },
  'FOOD': { mode: 'high', tags: ['Foodie'] },
  
  // Medium interaction categories
  'MUSIC': { mode: 'medium', tags: ['NightOwl'] },
  'FESTIVAL': { mode: 'medium', tags: ['NightOwl', 'FamilyFriendly'] },
  'MARKET': { mode: 'medium', tags: ['FamilyFriendly'] },
  'NIGHTLIFE': { mode: 'medium', tags: ['NightOwl'] },
  
  // Low interaction categories
  'LECTURE': { mode: 'low', tags: ['Curious', 'CultureVulture'] },
  'EDUCATION': { mode: 'low', tags: ['Curious'] },
  'SEMINAR': { mode: 'low', tags: ['Curious'] },
  
  // Passive categories
  'CINEMA': { mode: 'passive', tags: ['CultureVulture', 'DateNight'] },
  'THEATER': { mode: 'passive', tags: ['CultureVulture', 'DateNight'] },
  'EXHIBITION': { mode: 'passive', tags: ['CultureVulture', 'Curious'] },
  'CULTURE': { mode: 'passive', tags: ['CultureVulture'] },
  'MUSEUM': { mode: 'passive', tags: ['CultureVulture', 'Curious'] }
};

function classifyByGenericCategory(category: string): VibeClassification {
  const normalized = category.toUpperCase().replace(/[-_\s]/g, '');
  
  for (const [key, value] of Object.entries(CATEGORY_MODE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        interaction_mode: value.mode,
        confidence: 0.60,
        persona_tags: value.tags,
        reasoning: `Category match: ${key}`
      };
    }
  }
  
  // Default to medium interaction
  return {
    interaction_mode: 'medium',
    confidence: 0.40,
    persona_tags: [],
    reasoning: 'Default classification (no pattern matched)'
  };
}

// ============================================================================
// AI-ENHANCED CLASSIFICATION
// ============================================================================

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export interface AIVibeClassificationOptions {
  title: string;
  description: string;
  category?: string;
  venue?: string;
}

/**
 * Use AI to classify interaction mode when rules-based is uncertain
 */
export async function classifyVibeWithAI(
  apiKey: string,
  options: AIVibeClassificationOptions,
  fetcher: typeof fetch = fetch
): Promise<VibeClassification> {
  // First try rules-based
  const rulesResult = classifyVibe(
    options.category || '',
    `${options.title} ${options.description} ${options.venue || ''}`
  );
  
  // If rules are confident, use them
  if (rulesResult.confidence >= 0.75) {
    return rulesResult;
  }
  
  // Otherwise, use AI
  try {
    const response = await fetcher(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You classify event "interaction modes" for a social events app. Reply with JSON only.

Modes:
- high: Workshops, networking, meetups where attendees talk to strangers
- medium: Concerts, markets, festivals with some social interaction  
- low: Talks, lectures where attendees mostly listen
- passive: Movies, exhibitions with no interaction expected

Also suggest persona tags from: NightOwl, Curious, CultureVulture, Foodie, FamilyFriendly, DateNight, ExpatFriendly`
          },
          {
            role: "user",
            content: `Classify this event:
Title: ${options.title}
Description: ${options.description}
${options.category ? `Category: ${options.category}` : ''}
${options.venue ? `Venue: ${options.venue}` : ''}

Reply with JSON: {"mode": "high|medium|low|passive", "tags": ["Tag1", "Tag2"], "reasoning": "..."}`
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      console.warn(`AI vibe classification failed: ${response.status}`);
      return rulesResult;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return rulesResult;
    }

    const aiResult = JSON.parse(content);
    
    return {
      interaction_mode: aiResult.mode as InteractionMode,
      confidence: 0.85,
      persona_tags: aiResult.tags || [],
      reasoning: aiResult.reasoning || 'AI classification'
    };
    
  } catch (error) {
    console.error('AI vibe classification error:', error);
    return rulesResult;
  }
}

// ============================================================================
// PERSONA TAG INFERENCE
// ============================================================================

/**
 * Infer additional persona tags from event details
 */
export function inferPersonaTags(
  title: string,
  description: string,
  languageProfile: string,
  interactionMode: InteractionMode
): string[] {
  const tags = new Set<string>();
  const text = `${title} ${description}`.toLowerCase();
  
  // Expat-friendly if English
  if (languageProfile === 'EN' || languageProfile === 'Mixed') {
    tags.add('ExpatFriendly');
  }
  
  // Time-based tags
  if (text.includes('brunch') || text.includes('morning') || text.includes('ochtend')) {
    tags.add('EarlyBird');
  }
  if (text.includes('night') || text.includes('avond') || text.includes('nacht') || 
      text.includes('late') || text.includes('laat')) {
    tags.add('NightOwl');
  }
  
  // Content-based tags
  if (text.includes('food') || text.includes('eten') || text.includes('culinair') ||
      text.includes('diner') || text.includes('lunch') || text.includes('proeverij')) {
    tags.add('Foodie');
  }
  if (text.includes('kid') || text.includes('child') || text.includes('kind') ||
      text.includes('familie') || text.includes('family') || text.includes('gezin')) {
    tags.add('FamilyFriendly');
  }
  if (text.includes('romantic') || text.includes('date') || text.includes('valentijn') ||
      text.includes('couples') || text.includes('koppel')) {
    tags.add('DateNight');
  }
  if (text.includes('learn') || text.includes('leer') || text.includes('discover') ||
      text.includes('ontdek') || text.includes('education') || text.includes('educatie')) {
    tags.add('Curious');
  }
  
  // Interaction-based defaults
  if (interactionMode === 'passive') {
    tags.add('CultureVulture');
  }
  if (interactionMode === 'high') {
    tags.add('Curious');
  }
  
  return Array.from(tags);
}
