import { describe, it, expect } from 'vitest';
import {
  ALL_MUNICIPALITIES,
  getMunicipalitiesByMinPopulation,
  selectMunicipalitiesForDiscovery,
} from '../supabase/functions/_shared/dutchMunicipalities.ts';

describe('selectMunicipalitiesForDiscovery', () => {
  it('returns all municipalities over 1000 residents by default', () => {
    const expected = getMunicipalitiesByMinPopulation(1000);
    const baseline = getMunicipalitiesByMinPopulation(50000);
    const result = selectMunicipalitiesForDiscovery();

    expect(result.length).toBe(expected.length);
    expect(result.length).toBeGreaterThan(baseline.length);
  });

  it('respects explicit municipality filters and caps results', () => {
    const filtered = selectMunicipalitiesForDiscovery({
      municipalities: ['Vught', 'Amsterdam'],
    });

    expect(filtered.map((m) => m.name)).toContain('Amsterdam');
    expect(filtered.map((m) => m.name)).toContain('Vught');

    const capped = selectMunicipalitiesForDiscovery({
      municipalities: ['Vught', 'Amsterdam'],
      maxMunicipalities: 1,
    });

    expect(capped).toEqual(filtered.slice(0, 1));
  });
});
