/**
 * Feed Algorithm Examples and Test Scenarios
 * 
 * This file contains example scenarios to demonstrate how the feed algorithm works.
 * Use these examples to understand the algorithm's behavior and for testing.
 */

import type { EventForRanking, UserPreferences } from './feedAlgorithm';

/**
 * Example User Profiles
 */
export const exampleUsers: Record<string, UserPreferences> = {
  socialite: {
    selectedCategories: ['social', 'entertainment', 'music'],
    zone: 'Meppel, NL',
  },
  athlete: {
    selectedCategories: ['active', 'outdoors'],
    zone: 'Meppel, NL',
  },
  family: {
    selectedCategories: ['family', 'community', 'workshops'],
    zone: 'Meppel, NL',
  },
  gamer: {
    selectedCategories: ['gaming', 'entertainment'],
    zone: 'Meppel, NL',
  },
  foodie: {
    selectedCategories: ['foodie', 'social'],
    zone: 'Meppel, NL',
  },
  openToAll: {
    selectedCategories: [], // No preferences
    zone: 'Meppel, NL',
  },
};

/**
 * Example Events with Different Characteristics
 */
export const exampleEvents: EventForRanking[] = [
  // High social proof, happening soon
  {
    id: 'e1',
    title: 'Friday Night Drinks',
    category: 'social',
    event_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    attendee_count: 85,
    match_percentage: 88,
    venue_name: 'Café 1761',
    event_time: '19:00',
  },
  
  // Popular but far in future
  {
    id: 'e2',
    title: 'Summer Music Festival',
    category: 'music',
    event_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 2 months
    attendee_count: 500,
    match_percentage: 92,
    venue_name: 'Stadspark',
    event_time: '14:00',
  },
  
  // Low attendance, happening very soon
  {
    id: 'e3',
    title: 'Board Game Night',
    category: 'gaming',
    event_date: new Date(Date.now() + 0.5 * 24 * 60 * 60 * 1000).toISOString(), // 12 hours
    attendee_count: 5,
    match_percentage: 75,
    venue_name: 'Café De Ogge',
    event_time: '20:00',
  },
  
  // Family event, medium everything
  {
    id: 'e4',
    title: 'Kids Playdate',
    category: 'family',
    event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    attendee_count: 15,
    match_percentage: 80,
    venue_name: 'Wilhelminapark',
    event_time: '10:00',
  },
  
  // Active event, happening in a week
  {
    id: 'e5',
    title: 'Sunday Football Match',
    category: 'active',
    event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
    attendee_count: 22,
    match_percentage: 85,
    venue_name: 'Sportpark Ezinge',
    event_time: '14:00',
  },
  
  // Foodie event with high match but low social proof
  {
    id: 'e6',
    title: 'Cooking Workshop',
    category: 'foodie',
    event_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
    attendee_count: 8,
    match_percentage: 95,
    venue_name: 'Kulturhus De Plataan',
    event_time: '18:00',
  },
  
  // Community event with no attendees yet
  {
    id: 'e7',
    title: 'Neighborhood Cleanup',
    category: 'community',
    event_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
    attendee_count: 0,
    match_percentage: 65,
    venue_name: 'Haveltermade',
    event_time: '09:00',
  },
];

/**
 * Expected Behavior Examples
 * 
 * These examples demonstrate how different user preferences affect ranking:
 */

export const expectedBehaviors = {
  socialite: {
    topEvents: ['e1', 'e3'], // Should prioritize social and entertainment categories
    explanation: 'Social events happening soon get highest scores (category match + time relevance)',
  },
  
  athlete: {
    topEvents: ['e5'], // Should prioritize active/outdoors
    explanation: 'Active events rank high for this user despite being a week away',
  },
  
  family: {
    topEvents: ['e4', 'e7'], // Should prioritize family and community
    explanation: 'Family-focused user sees family and community events at top',
  },
  
  gamer: {
    topEvents: ['e3'], // Gaming event happening very soon
    explanation: 'Board game night ranks #1 due to perfect timing + category match',
  },
  
  foodie: {
    topEvents: ['e6', 'e1'], // Foodie and social events
    explanation: 'High match percentage on cooking workshop makes it rank high',
  },
  
  openToAll: {
    explanation: 'With no preferences, ranking is based on time + social proof + match score',
    note: 'Events happening sooner with more attendees rank higher',
  },
};

/**
 * Diversity Test Scenario
 * 
 * Events to test diversity mechanism - all social events with similar scores
 */
export const diversityTestEvents: EventForRanking[] = [
  {
    id: 'd1',
    title: 'Social Event 1',
    category: 'social',
    event_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    attendee_count: 50,
    match_percentage: 90,
  },
  {
    id: 'd2',
    title: 'Social Event 2',
    category: 'social',
    event_date: new Date(Date.now() + 1.1 * 24 * 60 * 60 * 1000).toISOString(),
    attendee_count: 48,
    match_percentage: 89,
  },
  {
    id: 'd3',
    title: 'Social Event 3',
    category: 'social',
    event_date: new Date(Date.now() + 1.2 * 24 * 60 * 60 * 1000).toISOString(),
    attendee_count: 47,
    match_percentage: 88,
  },
  {
    id: 'd4',
    title: 'Gaming Event',
    category: 'gaming',
    event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    attendee_count: 20,
    match_percentage: 75,
  },
];

/**
 * How to Use These Examples
 * 
 * 1. Import the rankEvents function and these examples
 * 2. Call rankEvents with different user preferences
 * 3. Compare results with expected behaviors
 * 4. Enable debug mode to see score breakdowns
 * 
 * Example:
 * ```typescript
 * import { rankEvents } from './feedAlgorithm';
 * import { exampleUsers, exampleEvents } from './feedAlgorithm.examples';
 * 
 * const rankedForSocialite = rankEvents(
 *   exampleEvents, 
 *   exampleUsers.socialite,
 *   { debug: true }
 * );
 * 
 * console.log('Top event:', rankedForSocialite[0].title);
 * ```
 */

/**
 * Edge Cases to Test
 */
export const edgeCases = {
  pastEvents: {
    description: 'Events in the past should get zero time score',
    example: {
      id: 'past1',
      title: 'Yesterday Event',
      category: 'social',
      event_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      attendee_count: 100,
      match_percentage: 100,
    },
  },
  
  nullValues: {
    description: 'Events with missing data should use defaults',
    example: {
      id: 'null1',
      title: 'Incomplete Event',
      category: 'social',
      event_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      attendee_count: undefined,
      match_percentage: null,
    },
  },
  
  extremeAttendance: {
    description: 'Very high attendance should be capped by logarithmic scaling',
    example: {
      id: 'huge1',
      title: 'Massive Concert',
      category: 'music',
      event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      attendee_count: 10000,
      match_percentage: 80,
    },
  },
};
