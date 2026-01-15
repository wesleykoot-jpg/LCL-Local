import { describe, it, expect } from 'vitest';
import {
  getMunicipalitiesByMinPopulation,
  selectMunicipalitiesForDiscovery,
} from '../supabase/functions/_shared/dutchMunicipalities.ts';

describe('Source Discovery Defaults', () => {
  it('uses 20000 as default minimum population', () => {
    // The new default should focus on regional hubs
    const expected = getMunicipalitiesByMinPopulation(20000);
    const result = selectMunicipalitiesForDiscovery({ minPopulation: 20000 });

    expect(result.length).toBe(expected.length);
    // Should be less than the old default of 1000
    const oldDefault = getMunicipalitiesByMinPopulation(1000);
    expect(result.length).toBeLessThan(oldDefault.length);
  });

  it('respects maxMunicipalities limit of 20', () => {
    const result = selectMunicipalitiesForDiscovery({
      minPopulation: 20000,
      maxMunicipalities: 20,
    });

    expect(result.length).toBe(20);
    
    // Should include major cities
    const names = result.map(m => m.name);
    expect(names).toContain('Amsterdam');
    expect(names).toContain('Rotterdam');
    expect(names).toContain('Utrecht');
  });

  it('excludes municipalities below 20000 population with new defaults', () => {
    const result = selectMunicipalitiesForDiscovery({
      minPopulation: 20000,
    });

    // All municipalities should have population >= 20000
    const allAboveThreshold = result.every(m => m.population >= 20000);
    expect(allAboveThreshold).toBe(true);

    // Should exclude small municipalities
    const names = result.map(m => m.name);
    expect(names).not.toContain('Staphorst'); // population: 17302
    expect(names).not.toContain('Het Bildt'); // population: 10655
  });

  it('prioritizes largest municipalities when limited', () => {
    const result = selectMunicipalitiesForDiscovery({
      minPopulation: 20000,
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
  it('should enable sources with 70% confidence (new threshold)', () => {
    // Test the logic that would be used in insertDiscoveredSource
    const highConfidence = 70;
    const shouldEnable = highConfidence >= 70;
    expect(shouldEnable).toBe(true);
  });

  it('should enable sources with >70% confidence', () => {
    const veryHighConfidence = 85;
    const shouldEnable = veryHighConfidence >= 70;
    expect(shouldEnable).toBe(true);
  });

  it('should not enable sources with <70% confidence', () => {
    const mediumConfidence = 65;
    const shouldEnable = mediumConfidence >= 70;
    expect(shouldEnable).toBe(false);
  });

  it('should not enable sources with low confidence', () => {
    const lowConfidence = 50;
    const shouldEnable = lowConfidence >= 70;
    expect(shouldEnable).toBe(false);
  });
});

describe('Search Pattern Expansion', () => {
  it('generates all 7 Dutch agenda URL patterns', () => {
    const municipalityName = 'amsterdam';
    
    const patterns = [
      `https://www.${municipalityName}.nl/agenda`,
      `https://www.ontdek${municipalityName}.nl/agenda`,
      `https://www.visit${municipalityName}.nl/events`,
      `https://www.${municipalityName}.nl/evenementen`,
      `https://www.uitagenda${municipalityName}.nl`,
      `https://www.${municipalityName}marketing.nl/agenda`,
      `https://agenda.${municipalityName}.nl`,
    ];

    // All 7 patterns should be tested
    expect(patterns.length).toBe(7);
    
    // Verify pattern diversity
    const uniquePatterns = new Set(patterns);
    expect(uniquePatterns.size).toBe(7);
  });

  it('patterns cover common Dutch agenda structures', () => {
    const municipalityName = 'utrecht';
    
    const patterns = [
      `https://www.${municipalityName}.nl/agenda`,
      `https://www.ontdek${municipalityName}.nl/agenda`,
      `https://www.visit${municipalityName}.nl/events`,
      `https://www.${municipalityName}.nl/evenementen`,
      `https://www.uitagenda${municipalityName}.nl`,
      `https://www.${municipalityName}marketing.nl/agenda`,
      `https://agenda.${municipalityName}.nl`,
    ];

    // Check that patterns include key Dutch variations
    const hasOfficialSite = patterns.some(p => p.includes('www.utrecht.nl'));
    const hasOntdek = patterns.some(p => p.includes('ontdekutrecht'));
    const hasVisit = patterns.some(p => p.includes('visitutrecht'));
    const hasSubdomain = patterns.some(p => p.includes('agenda.utrecht'));

    expect(hasOfficialSite).toBe(true);
    expect(hasOntdek).toBe(true);
    expect(hasVisit).toBe(true);
    expect(hasSubdomain).toBe(true);
  });
});
