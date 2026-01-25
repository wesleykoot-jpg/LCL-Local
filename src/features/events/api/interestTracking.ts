/**
 * Interest Tracking API
 * 
 * Functions to track user interactions with events and automatically detect
 * if the user is a parent based on their interest patterns.
 * 
 * NOTE: This module is currently a stub. The interest_scores and is_parent_detected
 * columns do not exist in the profiles table. These functions return mock data
 * to avoid breaking the build while the feature is pending implementation.
 */

export interface InterestScores {
  [categoryId: string]: number;
}

// In-memory storage for interest scores (temporary until DB columns are added)
const interestScoresCache = new Map<string, InterestScores>();
const parentDetectedCache = new Map<string, boolean>();

/**
 * Increment interest score for a category when user views or likes an event
 * NOTE: This is a stub implementation that stores data in memory only.
 */
export async function incrementInterestScore(
  profileId: string,
  categoryId: string,
  incrementBy: number = 1
): Promise<{ success: boolean; scores?: InterestScores; isParentDetected?: boolean }> {
  try {
    const currentScores = interestScoresCache.get(profileId) || {};
    const newScores = {
      ...currentScores,
      [categoryId]: (currentScores[categoryId] || 0) + incrementBy,
    };

    // Check if family score exceeds threshold
    const familyScore = newScores.family || 0;
    const wasParentDetected = parentDetectedCache.get(profileId) || false;
    const shouldDetectParent = familyScore > 5 && !wasParentDetected;

    if (shouldDetectParent) {
      parentDetectedCache.set(profileId, true);
    }

    interestScoresCache.set(profileId, newScores);

    return {
      success: true,
      scores: newScores,
      isParentDetected: parentDetectedCache.get(profileId) || false,
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
 * NOTE: This is a stub implementation that returns data from memory only.
 */
export async function getInterestScores(
  profileId: string
): Promise<{ scores?: InterestScores; isParentDetected?: boolean }> {
  try {
    return {
      scores: interestScoresCache.get(profileId) || {},
      isParentDetected: parentDetectedCache.get(profileId) || false,
    };
  } catch (error) {
    console.error('Error getting interest scores:', error);
    return {};
  }
}
