import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Profile from '../Profile';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    profile: {
      id: 'test-user',
      full_name: 'Test User',
      avatar_url: null,
      current_persona: 'social',
      bio: 'Test bio',
      reliability_score: 98,
      events_attended: 12,
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/shared/components', () => ({
  FloatingNav: () => <div>FloatingNav</div>,
}));

vi.mock('@/features/events/hooks/useUnifiedItinerary', () => ({
  useUnifiedItinerary: () => ({
    timelineItems: [],
    isLoading: false,
  }),
}));

vi.mock('@/shared/lib/haptics', () => ({
  hapticImpact: vi.fn(),
}));

vi.mock('@/lib/version', () => ({
  APP_VERSION: '1.0.0',
  APP_NAME: 'LCL',
}));

describe('Profile - Accessibility (v5.0 Social Air)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render tabs with proper ARIA roles', () => {
    render(<Profile />);
    
    const tablist = screen.getByRole('tablist', { name: /profile sections/i });
    expect(tablist).toBeDefined();
    
    const tabs = screen.getAllByRole('tab');
    // v5.0 design has 2 tabs: Passport and Settings (removed Wishlist)
    expect(tabs).toHaveLength(2);
  });

  it('should have proper aria-selected attributes', () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    
    expect(passportTab.getAttribute('aria-selected')).toBe('true');
    expect(settingsTab.getAttribute('aria-selected')).toBe('false');
  });

  it('should link tabs to panels with aria-controls', () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    expect(passportTab.getAttribute('aria-controls')).toBe('passport-panel');
    
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    expect(settingsTab.getAttribute('aria-controls')).toBe('settings-panel');
  });

  it('should render tabpanels with proper ARIA attributes', () => {
    render(<Profile />);
    
    const panel = screen.getByRole('tabpanel', { name: /passport/i });
    expect(panel.getAttribute('aria-labelledby')).toBe('passport-tab');
    expect(panel.getAttribute('id')).toBe('passport-panel');
  });

  it('should switch tabs on click', async () => {
    render(<Profile />);
    
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    fireEvent.click(settingsTab);
    
    await waitFor(() => {
      expect(settingsTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('should support keyboard navigation with Arrow keys', async () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    
    // Press ArrowRight to move to settings tab
    fireEvent.keyDown(passportTab, { key: 'ArrowRight' });
    
    await waitFor(() => {
      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      expect(settingsTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('should support keyboard navigation with ArrowLeft (wrap around)', async () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    
    // Press ArrowLeft to move to last tab (wrapping to settings)
    fireEvent.keyDown(passportTab, { key: 'ArrowLeft' });
    
    await waitFor(() => {
      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      expect(settingsTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('should have minimum 44px touch targets', () => {
    render(<Profile />);
    
    const tabs = screen.getAllByRole('tab');
    tabs.forEach(tab => {
      // Check class contains min-h-[44px]
      expect(tab.className).toContain('min-h-[44px]');
    });
  });

  it('should have aria-label on region sections in settings', async () => {
    render(<Profile />);
    
    // Navigate to settings tab to load SettingsDeck
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    fireEvent.click(settingsTab);
    
    // Wait for settings panel to render with regions
    await waitFor(() => {
      const regions = screen.queryAllByRole('region');
      expect(regions.length).toBeGreaterThan(0);
    });
  });
});
