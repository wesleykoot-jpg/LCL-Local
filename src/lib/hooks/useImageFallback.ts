import { useState, useCallback } from 'react';
import { CATEGORY_MAP } from '@/lib/categories';

/**
 * Fallback images by category - Dutch/Netherlands themed.
 * Used when the primary event image fails to load.
 */
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=900&q=80',
  gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80',
  family: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
  social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
  outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
  music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=900&q=80',
  workshops: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80',
  foodie: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
  entertainment: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
  nightlife: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-80cf83f14a8f?auto=format&fit=crop&w=900&q=80',
  culture: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=900&q=80',
  wellness: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
};

/**
 * A grey pattern fallback for when all image loads fail.
 */
export const GREY_PATTERN_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Cpath fill="%23d1d5db" d="M0 0h50v50H0zM50 50h50v50H50z"/%3E%3C/svg%3E';

/**
 * Gets the fallback image URL for a given category.
 * @param category - The event category
 * @returns Fallback image URL
 */
export function getCategoryFallback(category: string): string {
  const mappedCategory = CATEGORY_MAP[category] || category;
  return CATEGORY_FALLBACK_IMAGES[mappedCategory] || CATEGORY_FALLBACK_IMAGES.default;
}

/**
 * Gets the best available image for an event.
 * @param imageUrl - The primary image URL (may be null)
 * @param category - The event category for fallback
 * @returns Best available image URL
 */
export function getEventImage(imageUrl: string | null | undefined, category: string): string {
  if (imageUrl) return imageUrl;
  return getCategoryFallback(category);
}

/**
 * Hook for handling image loading with fallbacks.
 * Provides graceful degradation: primary URL -> category fallback -> grey pattern.
 * 
 * @param primaryUrl - The primary image URL to try first
 * @param category - The event category for category-specific fallback
 * @returns Object with current src and onError handler
 */
export function useImageFallback(primaryUrl: string, category: string) {
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const [, setErrorCount] = useState(0);

  const handleError = useCallback(() => {
    setErrorCount(prev => {
      const newCount = prev + 1;
      if (newCount === 1) {
        // First failure: try category fallback
        setCurrentSrc(getCategoryFallback(category));
      } else {
        // Second failure: use grey pattern
        setCurrentSrc(GREY_PATTERN_FALLBACK);
      }
      return newCount;
    });
  }, [category]);

  return { src: currentSrc, onError: handleError };
}
