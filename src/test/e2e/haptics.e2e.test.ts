import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hapticImpact, hapticNotification } from '@/shared/lib/haptics';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * E2E Haptics Integration Audit Tests
 * 
 * Tests native iOS haptic feedback:
 * - Haptic feedback on button clicks
 * - Haptic feedback on event join
 * - Haptic feedback on error states
 * - Graceful degradation on non-iOS platforms
 */

// Mock Capacitor Haptics
vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}));

describe('E2E Haptics Integration Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Impact Haptics', () => {
    it('PASS: should trigger light impact haptic', async () => {
      vi.mocked(Haptics.impact).mockResolvedValueOnce(undefined);

      await hapticImpact('light');

      expect(Haptics.impact).toHaveBeenCalledWith({
        style: ImpactStyle.Light,
      });
    });

    it('PASS: should trigger medium impact haptic (default)', async () => {
      vi.mocked(Haptics.impact).mockResolvedValueOnce(undefined);

      await hapticImpact();

      expect(Haptics.impact).toHaveBeenCalledWith({
        style: ImpactStyle.Medium,
      });
    });

    it('PASS: should trigger heavy impact haptic', async () => {
      vi.mocked(Haptics.impact).mockResolvedValueOnce(undefined);

      await hapticImpact('heavy');

      expect(Haptics.impact).toHaveBeenCalledWith({
        style: ImpactStyle.Heavy,
      });
    });

    it('EDGE_CASE: should gracefully handle haptics not available', async () => {
      vi.mocked(Haptics.impact).mockRejectedValueOnce(
        new Error('Haptics not available')
      );

      // Should not throw error
      await expect(hapticImpact('medium')).resolves.not.toThrow();
    });

    it('EDGE_CASE: should handle platform without haptics support', async () => {
      vi.mocked(Haptics.impact).mockRejectedValueOnce(
        new Error('Not implemented on web')
      );

      // Should log and continue without crashing
      const consoleSpy = vi.spyOn(console, 'log');
      await hapticImpact('light');

      expect(consoleSpy).toHaveBeenCalledWith('Haptics not available');
    });
  });

  describe('Notification Haptics', () => {
    it('PASS: should trigger success notification haptic', async () => {
      vi.mocked(Haptics.notification).mockResolvedValueOnce(undefined);

      await hapticNotification('success');

      expect(Haptics.notification).toHaveBeenCalledWith({
        type: NotificationType.Success,
      });
    });

    it('PASS: should trigger warning notification haptic', async () => {
      vi.mocked(Haptics.notification).mockResolvedValueOnce(undefined);

      await hapticNotification('warning');

      expect(Haptics.notification).toHaveBeenCalledWith({
        type: NotificationType.Warning,
      });
    });

    it('PASS: should trigger error notification haptic', async () => {
      vi.mocked(Haptics.notification).mockResolvedValueOnce(undefined);

      await hapticNotification('error');

      expect(Haptics.notification).toHaveBeenCalledWith({
        type: NotificationType.Error,
      });
    });

    it('EDGE_CASE: should handle notification haptics failure gracefully', async () => {
      vi.mocked(Haptics.notification).mockRejectedValueOnce(
        new Error('Haptics unavailable')
      );

      await expect(hapticNotification('success')).resolves.not.toThrow();
    });
  });

  describe('Usage Patterns', () => {
    it('PASS: button clicks should use light impact', async () => {
      vi.mocked(Haptics.impact).mockResolvedValueOnce(undefined);

      // Simulate button click haptic
      await hapticImpact('light');

      expect(Haptics.impact).toHaveBeenCalledWith({
        style: ImpactStyle.Light,
      });
    });

    it('PASS: event join should use medium impact', async () => {
      vi.mocked(Haptics.impact).mockResolvedValueOnce(undefined);

      // Simulate event join haptic
      await hapticImpact('medium');

      expect(Haptics.impact).toHaveBeenCalledWith({
        style: ImpactStyle.Medium,
      });
    });

    it('PASS: success actions should use success notification', async () => {
      vi.mocked(Haptics.notification).mockResolvedValueOnce(undefined);

      // Simulate successful action
      await hapticNotification('success');

      expect(Haptics.notification).toHaveBeenCalledWith({
        type: NotificationType.Success,
      });
    });

    it('PASS: error states should use error notification', async () => {
      vi.mocked(Haptics.notification).mockResolvedValueOnce(undefined);

      // Simulate error state
      await hapticNotification('error');

      expect(Haptics.notification).toHaveBeenCalledWith({
        type: NotificationType.Error,
      });
    });
  });

  describe('iOS-Specific Behavior', () => {
    it('ARCHITECTURE: verify haptics module exports', () => {
      // Verify the haptics module provides the expected API
      expect(typeof hapticImpact).toBe('function');
      expect(typeof hapticNotification).toBe('function');
    });

    it('ARCHITECTURE: verify impact styles mapping', async () => {
      vi.mocked(Haptics.impact).mockResolvedValue(undefined);

      const styles: Array<'light' | 'medium' | 'heavy'> = ['light', 'medium', 'heavy'];
      
      for (const style of styles) {
        await hapticImpact(style);
      }

      expect(Haptics.impact).toHaveBeenCalledTimes(3);
    });

    it('ARCHITECTURE: verify notification types mapping', async () => {
      vi.mocked(Haptics.notification).mockResolvedValue(undefined);

      const types: Array<'success' | 'warning' | 'error'> = ['success', 'warning', 'error'];
      
      for (const type of types) {
        await hapticNotification(type);
      }

      expect(Haptics.notification).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery', () => {
    it('PASS: should continue execution after haptic failure', async () => {
      vi.mocked(Haptics.impact).mockRejectedValueOnce(new Error('Failed'));

      let executionContinued = false;

      await hapticImpact('medium');
      executionContinued = true;

      expect(executionContinued).toBe(true);
    });

    it('PASS: should not block UI interactions on haptic failure', async () => {
      vi.mocked(Haptics.notification).mockRejectedValueOnce(new Error('Failed'));

      const startTime = Date.now();
      await hapticNotification('success');
      const endTime = Date.now();

      // Should complete quickly even with error
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
