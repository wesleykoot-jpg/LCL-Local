/**
 * Unit tests for Supabase client wrappers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listSources } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

// Mock fs for testing
vi.mock('fs');

describe('Supabase utilities', () => {
  describe('listSources', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should load and parse sources.json', () => {
      const mockSources = [
        {
          source_id: 'test.source',
          url: 'https://test.com',
          domain: 'test.com',
          rate_limit: {
            requests_per_minute: 10,
            concurrency: 1,
          },
        },
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSources));

      const sources = listSources();
      
      expect(sources).toEqual(mockSources);
      expect(sources[0].source_id).toBe('test.source');
      expect(sources[0].domain).toBe('test.com');
    });

    it('should throw error if sources.json does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => listSources()).toThrow('Sources file not found');
    });

    it('should handle multiple sources', () => {
      const mockSources = [
        {
          source_id: 'source1',
          url: 'https://example1.com',
          domain: 'example1.com',
        },
        {
          source_id: 'source2',
          url: 'https://example2.com',
          domain: 'example2.com',
        },
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSources));

      const sources = listSources();
      
      expect(sources).toHaveLength(2);
      expect(sources[0].source_id).toBe('source1');
      expect(sources[1].source_id).toBe('source2');
    });

    it('should handle sources with optional rate_limit', () => {
      const mockSources = [
        {
          source_id: 'source.without.rate',
          url: 'https://example.com',
          domain: 'example.com',
          // No rate_limit specified
        },
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSources));

      const sources = listSources();
      
      expect(sources[0].rate_limit).toBeUndefined();
    });
  });
});
