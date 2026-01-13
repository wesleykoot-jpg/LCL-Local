import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { ProfileView } from '../ProfileView';

const navigateMock = vi.fn();
const signOutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    profile: {
      id: 'user-1',
      full_name: 'Test User',
      location_city: 'City',
      location_country: 'Country',
      verified_resident: false,
      reliability_score: 90,
      events_attended: 1,
      events_committed: 1,
      current_persona: 'host',
      location_coordinates: null,
      profile_complete: true,
      created_at: '2024-01-01',
      avatar_url: null,
    },
    signOut: signOutMock,
  }),
}));

vi.mock('@/lib/hooks', () => ({
  usePersonaStats: () => ({ stats: null, loading: false }),
  usePersonaBadges: () => ({ badges: [], loading: false }),
  useUserCommitments: () => ({ commitments: [], loading: false }),
}));

vi.mock('@/hooks/useGoogleCalendar', () => ({
  useGoogleCalendar: () => ({ isConnected: false }),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(() => {}, {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/haptics', () => ({
  hapticImpact: vi.fn().mockResolvedValue(undefined),
}));

describe('ProfileView sign-out flow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('confirms sign out before calling signOut', async () => {
    render(<ProfileView />);

    fireEvent.click(screen.getByLabelText(/sign out/i));

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: /sign out/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
    });
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });
});
