import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QrPassModal from '../QrPassModal';
import AppShell from '../AppShell';
import * as AuthContextModule from '../../context/AuthContext';

// Mock schedule context for AppShell
vi.mock('../../context/ScheduleContext', () => ({
  useSchedule: () => ({
    mySchedule: [],
    spectating: [],
  }),
}));
vi.mock('../../context/AnnouncementsContext', () => ({
  useAnnouncements: () => ({
    announcements: [],
    loading: false,
    error: null,
    canManage: false,
    live: false,
    configured: false,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    togglePinned: vi.fn(),
  }),
}));

describe('QrPassModal Component Suite (Requirement R1 & R4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockParticipantProfile = {
    id: 'c8d9e234-5b6a-4f11-9a2c-7b8901234567',
    name: 'Jordan Lee',
    role: 'participant',
    email: 'jordan.lee@example.com',
    profile_setup_complete: true,
    checked_in_at: undefined,
  };

  test('renders modal with participant details and SVG QR code encoding UUID', () => {
    const handleOpenChange = vi.fn();
    render(
      <QrPassModal
        open={true}
        onOpenChange={handleOpenChange}
        profile={mockParticipantProfile}
      />,
    );

    // Header & title
    expect(screen.getByText('My QR Pass')).toBeInTheDocument();
    expect(screen.getByText('Emerald Summit Digital Pass')).toBeInTheDocument();

    // User details
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getByText('jordan.lee@example.com')).toBeInTheDocument();
    expect(screen.getByText('Participant')).toBeInTheDocument();

    // Monospace ID display
    expect(
      screen.getByText('c8d9e234-5b6a-4f11-9a2c-7b8901234567'),
    ).toBeInTheDocument();

    // Pending check-in status
    expect(screen.getByText('Pending Check-in')).toBeInTheDocument();

    // QR Code SVG verification
    const qrContainer = screen.getByTestId('qr-code-container');
    expect(qrContainer).toBeInTheDocument();
    const svgElement = qrContainer.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    expect(
      screen.getByLabelText(/QR code for user ID c8d9e234-5b6a-4f11-9a2c-7b8901234567/i),
    ).toBeInTheDocument();
  });

  test('displays "Checked In" status badge with formatted timestamp when checked_in_at is set', () => {
    const checkedInProfile = {
      ...mockParticipantProfile,
      checked_in_at: '2026-09-06T15:45:00Z',
    };

    render(
      <QrPassModal
        open={true}
        onOpenChange={vi.fn()}
        profile={checkedInProfile}
      />,
    );

    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.queryByText('Pending Check-in')).not.toBeInTheDocument();
  });

  test('copies user ID to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    render(
      <QrPassModal
        open={true}
        onOpenChange={vi.fn()}
        profile={mockParticipantProfile}
      />,
    );

    const copyBtn = screen.getByRole('button', { name: /Copy User ID/i });
    expect(copyBtn).toBeInTheDocument();

    await user.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith('c8d9e234-5b6a-4f11-9a2c-7b8901234567');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  test('role gating: AppShell displays "My QR Pass" for participant role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { user: { id: 'p-test', email: 'p@test.com' } } as any,
      profile: {
        id: 'p-test',
        name: 'Participant Tester',
        role: 'participant',
        email: 'p@test.com',
        profile_setup_complete: true,
      },
      loadingProfile: false,
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppShell>
          <div>Dashboard Child</div>
        </AppShell>
      </MemoryRouter>,
    );

    const qrPassButtons = screen.getAllByRole('button', { name: /My QR Pass/i });
    expect(qrPassButtons.length).toBeGreaterThan(0);
  });

  test('role gating: AppShell displays "My QR Pass" for ambassador role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { user: { id: 'amb-test', email: 'amb@test.com' } } as any,
      profile: {
        id: 'amb-test',
        name: 'Ambassador Tester',
        role: 'ambassador',
        email: 'amb@test.com',
        profile_setup_complete: true,
      },
      loadingProfile: false,
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppShell>
          <div>Ambassador Child</div>
        </AppShell>
      </MemoryRouter>,
    );

    const qrPassButtons = screen.getAllByRole('button', { name: /My QR Pass/i });
    expect(qrPassButtons.length).toBeGreaterThan(0);
  });

  test('role gating: AppShell does NOT display "My QR Pass" for volunteer or expert roles', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { user: { id: 'vol-test', email: 'vol@test.com' } } as any,
      profile: {
        id: 'vol-test',
        name: 'Volunteer Tester',
        role: 'volunteer',
        email: 'vol@test.com',
        profile_setup_complete: true,
      },
      loadingProfile: false,
      refreshProfile: vi.fn(),
    });

    const { rerender } = render(
      <MemoryRouter>
        <AppShell>
          <div>Volunteer Child</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /My QR Pass/i })).not.toBeInTheDocument();

    // Rerender as expert
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { user: { id: 'exp-test', email: 'exp@test.com' } } as any,
      profile: {
        id: 'exp-test',
        name: 'Expert Tester',
        role: 'expert',
        email: 'exp@test.com',
        profile_setup_complete: true,
      },
      loadingProfile: false,
      refreshProfile: vi.fn(),
    });

    rerender(
      <MemoryRouter>
        <AppShell>
          <div>Expert Child</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /My QR Pass/i })).not.toBeInTheDocument();
  });

  test('clicking "My QR Pass" in AppShell opens QrPassModal', async () => {
    const user = userEvent.setup();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { user: { id: 'user-open-test', email: 'user@test.com' } } as any,
      profile: {
        id: 'user-open-test',
        name: 'Open Modal User',
        role: 'participant',
        email: 'user@test.com',
        profile_setup_complete: true,
      },
      loadingProfile: false,
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppShell>
          <div>Test Main Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    const triggerBtn = screen.getAllByRole('button', { name: /My QR Pass/i })[0];
    await user.click(triggerBtn);

    const modal = await screen.findByTestId('qr-pass-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Open Modal User')).toBeInTheDocument();
  });
});
