/**
 * IO26 Social Intents
 * 
 * App Intents metadata structure for Apple Intelligence and Siri integration.
 * These intents allow LCL features to be exposed to Siri Shortcuts,
 * Spotlight Search, and Apple Intelligence suggestions.
 * 
 * Note: Full native implementation requires Swift/iOS App Intents framework.
 * This TypeScript module defines the metadata structure for web/hybrid usage
 * and serves as the source of truth for intent definitions.
 */

import type { PersonaType } from '@/lib/personaPredictor';

/**
 * Base intent metadata structure following Apple App Intents framework
 */
export interface AppIntentMetadata {
  /** Unique identifier for the intent */
  identifier: string;
  /** Human-readable title shown to users */
  title: string;
  /** Short description for Siri and Spotlight */
  description: string;
  /** Optional suggested Siri phrase */
  suggestedInvocationPhrase?: string;
  /** Icon SF Symbol name (for native iOS display) */
  systemImageName?: string;
  /** Required parameters for the intent */
  parameters?: IntentParameter[];
  /** Whether this intent can be run in the background */
  supportsBackgroundExecution?: boolean;
  /** Category for grouping in Shortcuts app */
  category?: 'social' | 'location' | 'events' | 'communication';
}

export interface IntentParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'location' | 'date';
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

/**
 * JoinNearestFork Intent
 * 
 * Allows users to quickly join the nearest fork/meetup event.
 * Example: "Hey Siri, join a nearby hangout on LCL"
 */
export const JoinNearestForkIntent: AppIntentMetadata = {
  identifier: 'com.lcl.intent.JoinNearestFork',
  title: 'Join Nearby Hangout',
  description: 'Join the nearest social event or meetup in your area',
  suggestedInvocationPhrase: 'Join a nearby hangout',
  systemImageName: 'person.2.fill',
  category: 'social',
  supportsBackgroundExecution: false,
  parameters: [
    {
      name: 'maxDistanceKm',
      type: 'number',
      required: false,
      description: 'Maximum distance in kilometers to search',
      defaultValue: 5,
    },
    {
      name: 'category',
      type: 'string',
      required: false,
      description: 'Optional category filter (e.g., social, music, gaming)',
    },
  ],
};

/**
 * BroadcastSignal Intent
 * 
 * Allows users to broadcast their availability or create an impromptu event.
 * Example: "Hey Siri, broadcast I'm free for coffee on LCL"
 */
export const BroadcastSignalIntent: AppIntentMetadata = {
  identifier: 'com.lcl.intent.BroadcastSignal',
  title: 'Broadcast Signal',
  description: 'Let nearby friends know you\'re available for a hangout',
  suggestedInvocationPhrase: 'Broadcast I\'m free',
  systemImageName: 'antenna.radiowaves.left.and.right',
  category: 'communication',
  supportsBackgroundExecution: false,
  parameters: [
    {
      name: 'message',
      type: 'string',
      required: false,
      description: 'Optional message about your availability',
    },
    {
      name: 'duration',
      type: 'number',
      required: false,
      description: 'How long you\'re available in hours',
      defaultValue: 2,
    },
    {
      name: 'activity',
      type: 'string',
      required: false,
      description: 'What you\'re up for (e.g., coffee, drinks, walk)',
    },
  ],
};

/**
 * SwitchPersona Intent
 * 
 * Quick persona switching via Siri.
 * Example: "Hey Siri, switch to family mode on LCL"
 */
export const SwitchPersonaIntent: AppIntentMetadata = {
  identifier: 'com.lcl.intent.SwitchPersona',
  title: 'Switch Persona',
  description: 'Change your current persona mode',
  suggestedInvocationPhrase: 'Switch to social mode',
  systemImageName: 'person.fill.questionmark',
  category: 'social',
  supportsBackgroundExecution: true,
  parameters: [
    {
      name: 'persona',
      type: 'string',
      required: true,
      description: 'The persona to switch to (social, family, professional)',
    },
  ],
};

/**
 * FindEventsNearby Intent
 * 
 * Search for events near the user's current location.
 */
export const FindEventsNearbyIntent: AppIntentMetadata = {
  identifier: 'com.lcl.intent.FindEventsNearby',
  title: 'Find Events Nearby',
  description: 'Discover events happening near your current location',
  suggestedInvocationPhrase: 'What\'s happening nearby',
  systemImageName: 'mappin.and.ellipse',
  category: 'events',
  supportsBackgroundExecution: false,
  parameters: [
    {
      name: 'timeframe',
      type: 'string',
      required: false,
      description: 'When to look for events (tonight, tomorrow, weekend)',
      defaultValue: 'tonight',
    },
    {
      name: 'category',
      type: 'string',
      required: false,
      description: 'Event category filter',
    },
  ],
};

/**
 * All registered intents for the app
 */
export const AllIntents: AppIntentMetadata[] = [
  JoinNearestForkIntent,
  BroadcastSignalIntent,
  SwitchPersonaIntent,
  FindEventsNearbyIntent,
];

/**
 * Intent execution result type
 */
export interface IntentExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Intent handler type
 */
export type IntentHandler<TParams = Record<string, unknown>> = (
  params: TParams
) => Promise<IntentExecutionResult>;

/**
 * Registry of intent handlers (for web/hybrid implementation)
 */
export const IntentHandlers: Record<string, IntentHandler> = {};

/**
 * Register an intent handler
 */
export function registerIntentHandler(
  intentId: string,
  handler: IntentHandler
): void {
  IntentHandlers[intentId] = handler;
}

/**
 * Execute an intent by ID
 */
export async function executeIntent(
  intentId: string,
  params: Record<string, unknown>
): Promise<IntentExecutionResult> {
  const handler = IntentHandlers[intentId];
  
  if (!handler) {
    return {
      success: false,
      message: `Intent handler not found: ${intentId}`,
    };
  }
  
  try {
    return await handler(params);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Intent execution failed',
    };
  }
}

/**
 * Get Siri Shortcuts configuration for the app
 * This can be used to generate the Shortcuts.plist for iOS
 */
export function getSiriShortcutsConfig(): {
  shortcuts: Array<{
    identifier: string;
    phrase: string;
    title: string;
  }>;
} {
  return {
    shortcuts: AllIntents
      .filter(intent => intent.suggestedInvocationPhrase)
      .map(intent => ({
        identifier: intent.identifier,
        phrase: intent.suggestedInvocationPhrase!,
        title: intent.title,
      })),
  };
}
