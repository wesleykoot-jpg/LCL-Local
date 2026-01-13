import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ShareProfile } from '../ShareProfile';

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(() => {}, {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    profile: {
      id: 'user-123',
      full_name: 'Test User',
      location_city: 'Test City',
      location_country: 'Testland',
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('ShareProfile', () => {
  const originalClipboard = navigator.clipboard;
  const originalShare = (navigator as any).share;

  afterEach(() => {
    (navigator as any).share = originalShare;
    Object.assign(navigator, { clipboard: originalClipboard });
    vi.restoreAllMocks();
  });

  it('uses navigator.share when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    (navigator as any).share = shareMock;
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

    render(
      <MemoryRouter>
        <ShareProfile />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText(/share profile link/i));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalled();
    });
  });

  it('copies link when navigator.share is unavailable', async () => {
    (navigator as any).share = undefined;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <MemoryRouter>
        <ShareProfile />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText(/share profile link/i));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://lcl-local.com/profile/user-123');
    });
  });
});
