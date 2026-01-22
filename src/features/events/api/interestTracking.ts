/**
 * Interest Tracking API
 * 
 * Functions to track user interactions with events and automatically detect
 * if the user is a parent based on their interest patterns.
 */

import { supabase } from '@/integrations/supabase/client';

export interface InterestScores {
  [categoryId: string]: number;
}

/**
 * Increment interest score for a category when user views or likes an event
 */
export async function incrementInterestScore(
  profileId: string,
  categoryId: string,
  incrementBy: number = 1
): Promise<{ success: boolean; scores?: InterestScores; isParentDetected?: boolean }> {
  try {
    // Get current scores
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('interest_scores, is_parent_detected')
      .eq('id', profileId)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return { success: false };
    }

    const currentScores = (profile?.interest_scores as unknown as InterestScores) || {};
    const newScores = {
      ...currentScores,
      [categoryId]: (currentScores[categoryId] || 0) + incrementBy,
    };

    // Check if family score exceeds threshold
    const familyScore = newScores.family || 0;
    const shouldDetectParent = familyScore > 5 && !profile?.is_parent_detected;

    // Update scores and potentially is_parent_detected
    const updateData: {
      interest_scores: InterestScores;
      is_parent_detected?: boolean;
    } = {
      interest_scores: newScores,
    };

    if (shouldDetectParent) {
      updateData.is_parent_detected = true;
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating interest scores:', updateError);
      return { success: false };
    }

    return {
      success: true,
      scores: data?.interest_scores as unknown as InterestScores,
      isParentDetected: data?.is_parent_detected,
    };
  } catch (error) {
    console.error('Error incrementing interest score:', error);
    return { success: false };
  }
}

/**
 * Track event view
 */
export function trackEventView(profileId: string, eventCategory: string) {
  return incrementInterestScore(profileId, eventCategory, 1);
}

/**
 * Track event like (higher weight)
 */
export function trackEventLike(profileId: string, eventCategory: string) {
  return incrementInterestScore(profileId, eventCategory, 2);
}

/**
 * Track event join (highest weight)
 */
export function trackEventJoin(profileId: string, eventCategory: string) {
  return incrementInterestScore(profileId, eventCategory, 3);
}

/**
 * Get current interest scores for a profile
 */
export async function getInterestScores(
  profileId: string
): Promise<{ scores?: InterestScores; isParentDetected?: boolean }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('interest_scores, is_parent_detected')
      .eq('id', profileId)
      .single();

    if (error) {
      console.error('Error fetching interest scores:', error);
      return {};
    }

    return {
      scores: (data?.interest_scores as unknown as InterestScores) || {},
      isParentDetected: data?.is_parent_detected || false,
    };
  } catch (error) {
    console.error('Error getting interest scores:', error);
    return {};
  }
}
