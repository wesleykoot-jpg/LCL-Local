import { render, screen, fireEvent } from '@testing-library/react';
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

describe('Profile - Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render tabs with proper ARIA roles', () => {
    render(<Profile />);
    
    const tablist = screen.getByRole('tablist', { name: /profile sections/i });
    expect(tablist).toBeDefined();
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('should have proper aria-selected attributes', () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    const wishlistTab = screen.getByRole('tab', { name: /wishlist/i });
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    
    expect(passportTab.getAttribute('aria-selected')).toBe('true');
    expect(wishlistTab.getAttribute('aria-selected')).toBe('false');
    expect(settingsTab.getAttribute('aria-selected')).toBe('false');
  });

  it('should link tabs to panels with aria-controls', () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    expect(passportTab.getAttribute('aria-controls')).toBe('passport-panel');
    
    const wishlistTab = screen.getByRole('tab', { name: /wishlist/i });
    expect(wishlistTab.getAttribute('aria-controls')).toBe('wishlist-panel');
    
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    expect(settingsTab.getAttribute('aria-controls')).toBe('settings-panel');
  });

  it('should render tabpanels with proper ARIA attributes', () => {
    render(<Profile />);
    
    const panel = screen.getByRole('tabpanel', { name: /passport/i });
    expect(panel.getAttribute('aria-labelledby')).toBe('passport-tab');
    expect(panel.getAttribute('id')).toBe('passport-panel');
  });

  it('should switch tabs on click', () => {
    render(<Profile />);
    
    const wishlistTab = screen.getByRole('tab', { name: /wishlist/i });
    fireEvent.click(wishlistTab);
    
    expect(wishlistTab.getAttribute('aria-selected')).toBe('true');
  });

  it('should support keyboard navigation with Arrow keys', () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    
    // Press ArrowRight to move to next tab
    fireEvent.keyDown(passportTab, { key: 'ArrowRight' });
    
    const wishlistTab = screen.getByRole('tab', { name: /wishlist/i });
    expect(wishlistTab.getAttribute('aria-selected')).toBe('true');
  });

  it('should support keyboard navigation with ArrowLeft', () => {
    render(<Profile />);
    
    const passportTab = screen.getByRole('tab', { name: /passport/i });
    
    // Press ArrowLeft to move to last tab (wrapping)
    fireEvent.keyDown(passportTab, { key: 'ArrowLeft' });
    
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    expect(settingsTab.getAttribute('aria-selected')).toBe('true');
  });

  it('should have minimum 44px touch targets', () => {
    render(<Profile />);
    
    const tabs = screen.getAllByRole('tab');
    tabs.forEach(tab => {
      // Check class contains min-h-[44px]
      expect(tab.className).toContain('min-h-[44px]');
    });
  });
});
