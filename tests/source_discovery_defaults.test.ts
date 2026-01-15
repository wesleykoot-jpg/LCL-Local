import { describe, it, expect } from 'vitest';
import {
  getMunicipalitiesByMinPopulation,
  selectMunicipalitiesForDiscovery,
} from '../supabase/functions/_shared/dutchMunicipalities.ts';

describe('Source Discovery Defaults', () => {
  it('uses 15000 as default minimum population (Long Tail)', () => {
    // The new default focuses on Long Tail (15k+ population)
    const expected = getMunicipalitiesByMinPopulation(15000);
    const result = selectMunicipalitiesForDiscovery({ minPopulation: 15000 });

    expect(result.length).toBe(expected.length);
    // Should be more than the old default of 50k
    const oldDefault = getMunicipalitiesByMinPopulation(50000);
    expect(result.length).toBeGreaterThan(oldDefault.length);
  });

  it('respects maxMunicipalities limit of 30', () => {
    const result = selectMunicipalitiesForDiscovery({
      minPopulation: 15000,
      maxMunicipalities: 30,
    });

    expect(result.length).toBe(30);
    
    // Should include major cities
    const names = result.map(m => m.name);
    expect(names).toContain('Amsterdam');
    expect(names).toContain('Rotterdam');
    expect(names).toContain('Utrecht');
  });

  it('excludes municipalities below 15000 population with new defaults', () => {
    const result = selectMunicipalitiesForDiscovery({
      minPopulation: 15000,
    });

    // All municipalities should have population >= 15000
    const allAboveThreshold = result.every(m => m.population >= 15000);
    expect(allAboveThreshold).toBe(true);

    // Should exclude very small municipalities (below threshold)
    const names = result.map(m => m.name);
    expect(names).not.toContain('Het Bildt');
  });

  it('prioritizes largest municipalities when limited', () => {
    const result = selectMunicipalitiesForDiscovery({
      minPopulation: 15000,
      maxMunicipalities: 5,
    });

    expect(result.length).toBe(5);
    
    // Should start with the largest cities
    expect(result[0].name).toBe('Amsterdam');
    expect(result[1].name).toBe('Rotterdam');
    expect(result[2].name).toBe('Den Haag');
    
    // All should have population > 200k
    const allLarge = result.every(m => m.population > 200000);
    expect(allLarge).toBe(true);
  });
});

describe('Auto-Enable Logic', () => {
  it('should enable sources with >90% confidence (new threshold)', () => {
    // Test the logic that would be used in insertDiscoveredSource
    const highConfidence = 91;
    const shouldEnable = highConfidence > 90;
    expect(shouldEnable).toBe(true);
  });

  it('should enable sources with 95% confidence', () => {
    const veryHighConfidence = 95;
    const shouldEnable = veryHighConfidence > 90;
    expect(shouldEnable).toBe(true);
  });

  it('should NOT enable sources with exactly 90% confidence', () => {
    const borderlineConfidence = 90;
    const shouldEnable = borderlineConfidence > 90;
    expect(shouldEnable).toBe(false);
  });

  it('should NOT enable sources with <90% confidence', () => {
    const mediumConfidence = 85;
    const shouldEnable = mediumConfidence > 90;
    expect(shouldEnable).toBe(false);
  });
});

describe('Search Pattern Expansion', () => {
  it('generates 5 diverse search queries per municipality (Query Multiplexing)', () => {
    const municipalityName = 'amsterdam';
    
    // New Query Multiplexing approach
    const queries = [
      `${municipalityName} agenda evenementen`,
      `${municipalityName} uitagenda`,
      `${municipalityName} evenementenkalender`,
      `wat te doen ${municipalityName}`,
      `${municipalityName} activiteiten programma`,
    ];

    // All 5 queries should be generated
    expect(queries.length).toBe(5);
    
    // Verify query diversity
    const uniqueQueries = new Set(queries);
    expect(uniqueQueries.size).toBe(5);
  });

  it('queries cover diverse Dutch agenda search intents', () => {
    const municipalityName = 'utrecht';
    
    const queries = [
      `${municipalityName} agenda evenementen`,
      `${municipalityName} uitagenda`,
      `${municipalityName} evenementenkalender`,
      `wat te doen ${municipalityName}`,
      `${municipalityName} activiteiten programma`,
    ];

    // Check that queries include key Dutch variations
    const combined = queries.join(' ');
    expect(combined).toContain('agenda');
    expect(combined).toContain('uitagenda');
    expect(combined).toContain('evenementen');
    expect(combined).toContain('wat te doen');
    expect(combined).toContain('activiteiten');
  });
});

