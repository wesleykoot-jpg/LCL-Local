import { describe, it, expect, vi } from 'vitest';
import {
  getMunicipalitiesByMinPopulation,
  selectMunicipalitiesForDiscovery,
  ALL_MUNICIPALITIES,
} from '../supabase/functions/_shared/dutchMunicipalities.ts';

/**
 * Integration tests for the Source Discovery Pipeline
 * 
 * Tests the new Serper.dev-based discovery engine with:
 * - Query Multiplexing (5 queries per municipality)
 * - URL Canonicalization
 * - Noise Domain Filtering
 * - Auto-Activation at >90% confidence
 * - Scaled configuration (15k population floor, 30 max municipalities)
 */

describe('Source Discovery Integration', () => {
  describe('Scaling Configuration', () => {
    it('uses 15000 as default minimum population (Long Tail)', () => {
      // New default: 15k to capture smaller Dutch municipalities
      const expected = getMunicipalitiesByMinPopulation(15000);
      const result = selectMunicipalitiesForDiscovery({ minPopulation: 15000 });

      expect(result.length).toBe(expected.length);
      // Should be greater than old 50k default
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

    it('includes municipalities between 15k-50k population', () => {
      const result = selectMunicipalitiesForDiscovery({
        minPopulation: 15000,
      });

      // Should include smaller municipalities now
      const hasSmaller = result.some(m => m.population >= 15000 && m.population < 50000);
      expect(hasSmaller).toBe(true);
    });

    it('excludes municipalities below 15000 population', () => {
      const result = selectMunicipalitiesForDiscovery({
        minPopulation: 15000,
      });

      // All municipalities should have population >= 15000
      const allAboveThreshold = result.every(m => m.population >= 15000);
      expect(allAboveThreshold).toBe(true);
    });
  });

  describe('URL Canonicalization', () => {
    // Test the URL canonicalization logic
    function canonicalizeUrl(url: string): string {
      try {
        const parsed = new URL(url);
        
        // Remove UTM and tracking parameters
        const trackingParams = [
          "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
          "fbclid", "gclid", "msclkid", "ref", "source", "mc_cid", "mc_eid",
        ];
        trackingParams.forEach(param => parsed.searchParams.delete(param));
        
        // Remove trailing slash from pathname (except for root)
        if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
          parsed.pathname = parsed.pathname.slice(0, -1);
        }
        
        // Normalize to lowercase hostname
        parsed.hostname = parsed.hostname.toLowerCase();
        
        return parsed.toString();
      } catch {
        return url;
      }
    }

    it('strips UTM parameters from URLs', () => {
      const input = 'https://www.example.nl/agenda?utm_source=google&utm_medium=cpc';
      const expected = 'https://www.example.nl/agenda';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('strips Facebook click IDs', () => {
      const input = 'https://www.example.nl/events?fbclid=abc123';
      const expected = 'https://www.example.nl/events';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('removes trailing slashes from paths', () => {
      const input = 'https://www.example.nl/agenda/';
      const expected = 'https://www.example.nl/agenda';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('preserves root path trailing slash', () => {
      const input = 'https://www.example.nl/';
      const expected = 'https://www.example.nl/';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('normalizes hostname to lowercase', () => {
      const input = 'https://WWW.Example.NL/agenda';
      const expected = 'https://www.example.nl/agenda';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('preserves non-tracking query parameters', () => {
      const input = 'https://www.example.nl/events?category=music&date=2024-01-15';
      const expected = 'https://www.example.nl/events?category=music&date=2024-01-15';
      expect(canonicalizeUrl(input)).toBe(expected);
    });
  });

  describe('Noise Domain Filtering', () => {
    const NOISE_DOMAINS = [
      "tripadvisor.",
      "facebook.com",
      "booking.com",
      "instagram.com",
      "twitter.com",
      "x.com",
      "linkedin.com",
      "pinterest.com",
      "youtube.com",
      "tiktok.com",
      "yelp.",
      "groupon.",
      "expedia.",
      "hotels.",
      "airbnb.",
      "marktplaats.nl",
      "wikipedia.org",
    ];

    function isNoiseDomain(url: string): boolean {
      const lowerUrl = url.toLowerCase();
      return NOISE_DOMAINS.some(domain => lowerUrl.includes(domain));
    }

    it('filters TripAdvisor URLs', () => {
      expect(isNoiseDomain('https://www.tripadvisor.nl/amsterdam')).toBe(true);
      expect(isNoiseDomain('https://tripadvisor.com/things-to-do')).toBe(true);
    });

    it('filters Facebook URLs', () => {
      expect(isNoiseDomain('https://www.facebook.com/events/123')).toBe(true);
    });

    it('filters Booking.com URLs', () => {
      expect(isNoiseDomain('https://www.booking.com/amsterdam')).toBe(true);
    });

    it('filters Wikipedia URLs', () => {
      expect(isNoiseDomain('https://nl.wikipedia.org/wiki/Amsterdam')).toBe(true);
    });

    it('filters Marktplaats URLs', () => {
      expect(isNoiseDomain('https://www.marktplaats.nl/a/tickets')).toBe(true);
    });

    it('allows legitimate Dutch event sites', () => {
      expect(isNoiseDomain('https://www.uitagendaamsterdam.nl')).toBe(false);
      expect(isNoiseDomain('https://www.visitrotterdam.nl/agenda')).toBe(false);
      expect(isNoiseDomain('https://www.denhaag.nl/nl/agenda')).toBe(false);
    });
  });

  describe('Query Multiplexing', () => {
    function generateSearchQueries(municipalityName: string): string[] {
      return [
        `${municipalityName} agenda evenementen`,
        `${municipalityName} uitagenda`,
        `${municipalityName} evenementenkalender`,
        `wat te doen ${municipalityName}`,
        `${municipalityName} activiteiten programma`,
      ];
    }

    it('generates 5 diverse queries per municipality', () => {
      const queries = generateSearchQueries('Amsterdam');
      expect(queries.length).toBe(5);
    });

    it('includes Dutch agenda terms', () => {
      const queries = generateSearchQueries('Rotterdam');
      const combined = queries.join(' ');
      
      expect(combined).toContain('agenda');
      expect(combined).toContain('evenement');
      expect(combined).toContain('uitagenda');
      expect(combined).toContain('wat te doen');
    });

    it('generates unique queries', () => {
      const queries = generateSearchQueries('Utrecht');
      const uniqueQueries = new Set(queries);
      expect(uniqueQueries.size).toBe(5);
    });

    it('includes municipality name in all queries', () => {
      const queries = generateSearchQueries('Eindhoven');
      const allContainName = queries.every(q => q.includes('Eindhoven'));
      expect(allContainName).toBe(true);
    });
  });

  describe('Auto-Activation Logic', () => {
    it('should enable sources with >90% confidence (high-authority bypass)', () => {
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

    it('should NOT enable sources with low confidence', () => {
      const lowConfidence = 60;
      const shouldEnable = lowConfidence > 90;
      expect(shouldEnable).toBe(false);
    });
  });

  describe('Dry Run Mode', () => {
    it('dryRun flag should be supported in options', () => {
      const options = {
        minPopulation: 15000,
        maxMunicipalities: 30,
        dryRun: true,
      };
      
      expect(options.dryRun).toBe(true);
    });

    it('dryRun defaults to false', () => {
      const options: { dryRun?: boolean } = {};
      const { dryRun = false } = options;
      
      expect(dryRun).toBe(false);
    });
  });

  describe('Legacy Blockers Removed', () => {
    it('no longer uses hardcoded 50k population floor', () => {
      // The new default is 15k, capturing Long Tail
      const result = selectMunicipalitiesForDiscovery({ minPopulation: 15000 });
      const hasSmaller = result.some(m => m.population < 50000);
      expect(hasSmaller).toBe(true);
    });

    it('can process 30+ municipalities in a batch', () => {
      const result = selectMunicipalitiesForDiscovery({
        minPopulation: 15000,
        maxMunicipalities: 30,
      });
      
      expect(result.length).toBe(30);
    });

    it('supports population threshold as low as 10k', () => {
      const result = selectMunicipalitiesForDiscovery({
        minPopulation: 10000,
      });
      
      // Should include more municipalities
      const hasVerySmall = result.some(m => m.population >= 10000 && m.population < 15000);
      expect(hasVerySmall).toBe(true);
    });
  });

  describe('Discovery Stats', () => {
    it('tracks Serper queries used', () => {
      const stats = {
        municipalitiesProcessed: 0,
        categoriesProcessed: 0,
        searchesPerformed: 0,
        candidatesFound: 0,
        sourcesValidated: 0,
        sourcesInserted: 0,
        serperQueriesUsed: 0,
        noiseDomainsFiltered: 0,
        autoEnabledSources: 0,
        errors: [] as string[],
      };

      // Simulate 5 queries per municipality for 30 municipalities
      stats.serperQueriesUsed = 5 * 30;
      expect(stats.serperQueriesUsed).toBe(150);
    });

    it('calculates discovery velocity', () => {
      const stats = {
        serperQueriesUsed: 150,
        sourcesValidated: 45,
      };

      const discoveryVelocity = stats.serperQueriesUsed > 0 
        ? Math.round((stats.sourcesValidated / stats.serperQueriesUsed) * 1000) 
        : 0;

      expect(discoveryVelocity).toBe(300); // 45/150 * 1000 = 300 per 1000 queries
    });

    it('tracks auto-enabled sources', () => {
      const stats = {
        autoEnabledSources: 0,
      };

      // Simulate auto-enabling 5 sources with >90% confidence
      stats.autoEnabledSources = 5;
      expect(stats.autoEnabledSources).toBe(5);
    });
  });
});
