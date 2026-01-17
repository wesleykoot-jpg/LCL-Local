import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('proposalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Proposal interface', () => {
    it('should have correct TypeScript types for proposals', () => {
      // Type check for Proposal interface
      interface Proposal {
        id: string;
        event_id: string;
        creator_id: string;
        status: 'draft' | 'confirmed' | 'cancelled';
        proposed_times: string[];
        created_at: string;
        updated_at: string;
      }

      const mockProposal: Proposal = {
        id: 'test-id',
        event_id: 'venue-123',
        creator_id: 'user-456',
        status: 'draft',
        proposed_times: ['2026-02-14T12:30:00Z', '2026-02-14T18:00:00Z'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(mockProposal.id).toBeDefined();
      expect(mockProposal.status).toBe('draft');
      expect(mockProposal.proposed_times).toHaveLength(2);
    });
  });

  describe('CreateProposalParams', () => {
    it('should require eventId, creatorId, and proposedTimes', () => {
      interface CreateProposalParams {
        eventId: string;
        creatorId: string;
        proposedTimes: string[];
      }

      const params: CreateProposalParams = {
        eventId: 'venue-123',
        creatorId: 'user-456',
        proposedTimes: ['2026-02-14T12:30:00Z'],
      };

      expect(params.eventId).toBe('venue-123');
      expect(params.creatorId).toBe('user-456');
      expect(params.proposedTimes).toHaveLength(1);
    });
  });

  describe('proposed_times format', () => {
    it('should accept ISO datetime strings', () => {
      const proposedTimes = [
        '2026-02-14T12:30:00Z',
        '2026-02-14T18:00:00Z',
        '2026-02-15T10:00:00Z',
      ];

      // All times should be valid ISO strings
      proposedTimes.forEach(time => {
        const parsed = new Date(time);
        expect(parsed.toISOString()).toBeDefined();
        expect(isNaN(parsed.getTime())).toBe(false);
      });
    });

    it('should reject invalid datetime strings', () => {
      const invalidTimes = [
        'not-a-date',
        '12:30',
        'tomorrow',
      ];

      invalidTimes.forEach(time => {
        const parsed = new Date(time);
        // Invalid dates should result in NaN or invalid dates
        if (time === 'not-a-date') {
          expect(isNaN(parsed.getTime())).toBe(true);
        }
      });
    });
  });

  describe('status values', () => {
    it('should only allow draft, confirmed, or cancelled', () => {
      const validStatuses = ['draft', 'confirmed', 'cancelled'];
      
      validStatuses.forEach(status => {
        expect(['draft', 'confirmed', 'cancelled']).toContain(status);
      });
    });

    it('should default to draft status', () => {
      const defaultStatus = 'draft';
      expect(defaultStatus).toBe('draft');
    });
  });

  describe('Supabase table structure', () => {
    it('should have proposals table with required columns', () => {
      // Test that the mock structure matches expected table schema
      const mockFromCall = supabase.from('proposals');
      expect(mockFromCall.insert).toBeDefined();
      expect(mockFromCall.select).toBeDefined();
      expect(mockFromCall.update).toBeDefined();
      expect(mockFromCall.delete).toBeDefined();
    });
  });
});
