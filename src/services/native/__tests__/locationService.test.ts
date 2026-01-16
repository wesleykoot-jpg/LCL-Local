import { describe, expect, it } from 'vitest';
import { locationService } from '@/services/native/locationService';

describe('locationService', () => {
  it('returns mock coordinates in test environment', async () => {
    const position = await locationService.getCurrentPosition();

    expect(position.coords.latitude).toBeCloseTo(52.3676, 3);
    expect(position.coords.longitude).toBeCloseTo(4.9041, 3);
  });

  it('returns granted permissions in test environment', async () => {
    const status = await locationService.checkPermissions();

    expect(status.location).toBe('granted');
  });
});
