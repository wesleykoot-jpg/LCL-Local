/**
 * Language Detection Service
 * 
 * Detects language profile (NL/EN/Mixed/Other) from text content.
 * Uses a rules-based approach with Dutch language indicators.
 * 
 * @module _shared/languageDetection
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Minimum confidence threshold to classify as NL or EN */
const CONFIDENCE_THRESHOLD = 0.6;

/** Minimum text length for reliable detection */
const MIN_TEXT_LENGTH = 50;

/** Language profile as defined in Social Five schema */
export type LanguageProfile = 'NL' | 'EN' | 'Mixed' | 'Other';

export interface LanguageDetectionResult {
  language: LanguageProfile;
  confidence: number;
  dutchScore: number;
  englishScore: number;
  indicators: string[];
}

// ============================================================================
// DUTCH LANGUAGE INDICATORS
// ============================================================================

/** High-confidence Dutch words (rarely used in English) */
const DUTCH_HIGH_CONFIDENCE = new Set([
  // Common Dutch words
  'het', 'een', 'van', 'dat', 'niet', 'voor', 'zijn', 'maar', 'ook', 
  'naar', 'deze', 'meer', 'kan', 'nog', 'wel', 'moet', 'jouw', 'geen',
  'wordt', 'worden', 'alle', 'hier', 'daar', 'veel', 'door', 'gratis',
  
  // Event-specific Dutch
  'aanvang', 'zaal', 'deuren', 'entree', 'toegang', 'reserveren', 'kaartjes',
  'kaarten', 'ingang', 'uitgang', 'programma', 'voorstelling', 'optreden',
  
  // Time Dutch
  'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag',
  'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus',
  'september', 'oktober', 'november', 'december',
  'uur', 'minuten', 'morgen', 'vanmiddag', 'vanavond', 'vannacht',
  
  // Dutch conjunctions/prepositions
  'tegen', 'tijdens', 'tussen', 'volgens', 'vanuit', 'vanaf', 'omheen',
  'langs', 'behalve', 'ondanks', 'binnen', 'buiten', 'zonder',
  
  // Dutch articles/pronouns
  'ik', 'jij', 'hij', 'zij', 'wij', 'jullie', 'hun', 'haar', 'mijn',
  'onze', 'ons', 'hen', 'wie', 'wat', 'waar', 'wanneer', 'hoe'
]);

/** Dutch word endings */
const DUTCH_ENDINGS = [
  'heid', 'lijk', 'isch', 'isch', 'atie', 'eren', 'ing', 'isme', 'isten'
];

/** Dutch digraphs unique to Dutch */
const DUTCH_DIGRAPHS = ['ij', 'ee', 'oo', 'aa', 'uu'];

// ============================================================================
// ENGLISH LANGUAGE INDICATORS
// ============================================================================

/** High-confidence English words */
const ENGLISH_HIGH_CONFIDENCE = new Set([
  // Common English articles/prepositions
  'the', 'of', 'and', 'to', 'in', 'is', 'you', 'that', 'it', 'for',
  'are', 'with', 'as', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
  'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all',
  'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
  
  // Event-specific English
  'doors', 'entry', 'tickets', 'show', 'concert', 'venue', 'event',
  'registration', 'free', 'admission', 'starts', 'opens', 'ends',
  
  // English days/months
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december'
]);

/** Explicit English markers */
const ENGLISH_EXPLICIT_MARKERS = [
  'in english',
  'english spoken',
  'english language',
  'performed in english',
  'presented in english',
  'english subtitles',
  'international event',
  'all english',
  'expats welcome'
];

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect language profile from text content
 */
export function detectLanguage(text: string): LanguageProfile {
  const result = analyzeLanguage(text);
  return result.language;
}

/**
 * Detailed language analysis with confidence scores
 */
export function analyzeLanguage(text: string): LanguageDetectionResult {
  if (!text || text.length < MIN_TEXT_LENGTH) {
    return {
      language: 'Other',
      confidence: 0,
      dutchScore: 0,
      englishScore: 0,
      indicators: ['Text too short for reliable detection']
    };
  }
  
  const normalizedText = text.toLowerCase();
  const words = normalizedText.match(/\b[a-z]{2,}\b/g) || [];
  
  if (words.length < 10) {
    return {
      language: 'Other',
      confidence: 0,
      dutchScore: 0,
      englishScore: 0,
      indicators: ['Not enough words for reliable detection']
    };
  }
  
  const indicators: string[] = [];
  let dutchPoints = 0;
  let englishPoints = 0;
  
  // Check explicit English markers (high weight)
  for (const marker of ENGLISH_EXPLICIT_MARKERS) {
    if (normalizedText.includes(marker)) {
      englishPoints += 10;
      indicators.push(`Found explicit marker: "${marker}"`);
    }
  }
  
  // Count high-confidence Dutch words
  let dutchWordCount = 0;
  for (const word of words) {
    if (DUTCH_HIGH_CONFIDENCE.has(word)) {
      dutchWordCount++;
    }
  }
  if (dutchWordCount > 0) {
    dutchPoints += dutchWordCount * 2;
    indicators.push(`Found ${dutchWordCount} Dutch indicator words`);
  }
  
  // Count high-confidence English words
  let englishWordCount = 0;
  for (const word of words) {
    if (ENGLISH_HIGH_CONFIDENCE.has(word)) {
      englishWordCount++;
    }
  }
  if (englishWordCount > 0) {
    englishPoints += englishWordCount * 2;
    indicators.push(`Found ${englishWordCount} English indicator words`);
  }
  
  // Check Dutch digraphs
  for (const digraph of DUTCH_DIGRAPHS) {
    const count = (normalizedText.match(new RegExp(digraph, 'g')) || []).length;
    if (count > 2) {
      dutchPoints += Math.min(count, 5);
    }
  }
  
  // Check Dutch word endings
  for (const word of words) {
    for (const ending of DUTCH_ENDINGS) {
      if (word.endsWith(ending) && word.length > ending.length + 2) {
        dutchPoints += 1;
        break;
      }
    }
  }
  
  // Check for 'ij' digraph (very Dutch)
  if (normalizedText.includes('ij')) {
    const ijCount = (normalizedText.match(/ij/g) || []).length;
    if (ijCount >= 2) {
      dutchPoints += ijCount * 2;
      indicators.push(`Found ${ijCount} "ij" digraphs (Dutch indicator)`);
    }
  }
  
  // Normalize scores
  const totalPoints = dutchPoints + englishPoints + 1; // +1 to avoid division by zero
  const dutchScore = dutchPoints / totalPoints;
  const englishScore = englishPoints / totalPoints;
  
  // Determine language
  let language: LanguageProfile;
  let confidence: number;
  
  if (dutchScore > CONFIDENCE_THRESHOLD && englishScore < 0.2) {
    language = 'NL';
    confidence = dutchScore;
  } else if (englishScore > CONFIDENCE_THRESHOLD && dutchScore < 0.2) {
    language = 'EN';
    confidence = englishScore;
  } else if (dutchScore > 0.3 && englishScore > 0.3) {
    language = 'Mixed';
    confidence = Math.max(dutchScore, englishScore);
  } else if (dutchScore > englishScore) {
    language = 'NL';
    confidence = dutchScore;
  } else if (englishScore > dutchScore) {
    language = 'EN';
    confidence = englishScore;
  } else {
    language = 'Other';
    confidence = 0.3;
  }
  
  return {
    language,
    confidence,
    dutchScore,
    englishScore,
    indicators
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if text explicitly indicates English content
 */
export function hasExplicitEnglishMarker(text: string): boolean {
  const normalized = text.toLowerCase();
  return ENGLISH_EXPLICIT_MARKERS.some(marker => normalized.includes(marker));
}

/**
 * Check if this is likely an international/expat-friendly event
 */
export function isExpatFriendly(text: string): boolean {
  const result = analyzeLanguage(text);
  
  if (result.language === 'EN') return true;
  if (result.language === 'Mixed') return true;
  if (hasExplicitEnglishMarker(text)) return true;
  
  // Additional expat indicators
  const expatIndicators = [
    'internationaal', 'international',
    'expat', 'english',
    'foreigners welcome',
    'newcomers'
  ];
  
  const normalized = text.toLowerCase();
  return expatIndicators.some(ind => normalized.includes(ind));
}

/**
 * Get language profile suitable for database storage
 */
export function getLanguageProfileForDB(text: string): { 
  language_profile: LanguageProfile; 
  language_confidence: number 
} {
  const result = analyzeLanguage(text);
  return {
    language_profile: result.language,
    language_confidence: Math.round(result.confidence * 100) / 100
  };
}
