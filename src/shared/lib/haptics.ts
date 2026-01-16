import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { PersonaType } from '@/lib/personaPredictor';

/**
 * IO26 Haptic Manager
 * 
 * Provides persona-aware haptic feedback following Apple HIG 2026.
 * Different personas have distinct vibration patterns:
 * - Social -> Light (Energetic, playful)
 * - Family -> Medium (Grounded, comforting)
 * - Professional -> Heavy (Rigid, formal)
 */

// IO26: Persona to vibration style mapping
const PERSONA_HAPTIC_MAP: Record<PersonaType, 'light' | 'medium' | 'heavy'> = {
  social: 'light',      // Energetic
  family: 'medium',     // Grounded
  professional: 'heavy', // Rigid/Formal
};

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const impactStyles = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({ style: impactStyles[style] });
  } catch (error) {
    console.log('Haptics not available');
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  try {
    const notificationTypes = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: notificationTypes[type] });
  } catch (error) {
    console.log('Haptics not available');
  }
}

/**
 * IO26: Trigger haptic feedback based on the current persona.
 * Uses the persona-to-vibration mapping for context-aware feedback.
 * 
 * @param persona - The current user persona
 */
export async function hapticForPersona(persona: PersonaType): Promise<void> {
  const style = PERSONA_HAPTIC_MAP[persona];
  await hapticImpact(style);
}

/**
 * IO26: Selection haptic feedback
 * Light tap for selection changes
 */
export async function hapticSelection(): Promise<void> {
  try {
    await Haptics.selectionStart();
    await Haptics.selectionEnd();
  } catch (error) {
    console.log('Haptics not available');
  }
}

/**
 * IO26: Success haptic pattern
 * Double-tap pattern for successful actions
 */
export async function hapticSuccess(): Promise<void> {
  await hapticNotification('success');
}

/**
 * IO26: Warning haptic pattern
 */
export async function hapticWarning(): Promise<void> {
  await hapticNotification('warning');
}

/**
 * IO26: Error haptic pattern
 */
export async function hapticError(): Promise<void> {
  await hapticNotification('error');
}

/**
 * Get the haptic style for a given persona
 */
export function getPersonaHapticStyle(persona: PersonaType): 'light' | 'medium' | 'heavy' {
  return PERSONA_HAPTIC_MAP[persona];
}
