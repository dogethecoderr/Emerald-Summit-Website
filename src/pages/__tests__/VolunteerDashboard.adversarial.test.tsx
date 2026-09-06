import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VolunteerDashboard from '../VolunteerDashboard';
import * as useRequireProfileModule from '../../hooks/useRequireProfile';
import { MOCK_PEOPLE } from '../../models/people';


const { mockSupabaseClient, mockDbUsers } = vi.hoisted(() => {
  const users = [
    {
      id: 'p8',
      name: 'Jordan Wu',
      role: 'participant',
      email: 'j.wu@emeraldhigh.edu',
      checked_in_at: null,
    },
    {
      id: '44444444-4444-4444-8888-444444444444',
      name: 'External Attendee',
      role: 'participant',
      email: 'external@example.com',
      checked_in_at: null,
    },
  ];

  const client = {
    from: vi.fn((_table: string) => {
      let filterId: string | null = null;
      let updatePayload: any = null;

      const builder: any = {
        select: vi.fn(() => builder),
        update: vi.fn((payload: any) => {
          updatePayload = payload;
          return builder;
        }),
        eq: vi.fn((col: string, val: any) => {
          if (col === 'id') filterId = val;
          return builder;
        }),
        then: vi.fn((onFulfilled: any) => {
          if (updatePayload && filterId) {
            const u = users.find((item) => item.id === filterId);
            if (u) Object.assign(u, updatePayload);
          }
          return Promise.resolve({ data: null, error: null }).then(onFulfilled);
        }),
        single: vi.fn(async () => {
          const user = users.find((u) => u.id === filterId);
          if (!user) return { data: null, error: { message: 'User not found' } };
          return { data: { ...user }, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          const user = users.find((u) => u.id === filterId);
          if (!user) return { data: null, error: null };
          return { data: { ...user }, error: null };
        }),
      };
      return builder;
    }),
  };

  return { mockSupabaseClient: client, mockDbUsers: users };
});

vi.mock('../../context/ScheduleContext', () => ({
  useSchedule: () => ({
    mySchedule: [],
    spectating: [],
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { email: 'volunteer@example.com' } },
    profile: {
      name: 'Demo Volunteer',
      role: 'volunteer',
      email: 'volunteer@example.com',
    },
    loadingProfile: false,
  }),
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    isScanning: true,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockReturnValue(undefined),
  })),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Adversarial Test: VolunteerDashboard State Synchronization & Fallback Preservation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Reset Jordan Wu's mock status in MOCK_PEOPLE so tests are isolated
    const jordan = MOCK_PEOPLE.find((p) => p.id === 'p8');
    if (jordan) jordan.status = 'validated';

    // Reset mock database records
    mockDbUsers[0].checked_in_at = null;
    mockDbUsers[1].checked_in_at = null;

    vi.spyOn(useRequireProfileModule, 'useRequireRole').mockReturnValue({
      ready: true,
      redirect: null,
      roleName: 'volunteer',
    });
  });

  const renderDashboard = () => {
    return render(
      <MemoryRouter>
        <VolunteerDashboard assignedTrack="novasphere" />
      </MemoryRouter>,
    );
  };

  test('interleaved QR scanner check-in and manual roster check-in/undo maintains exact counter integrity', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // In novasphere track: 3 participants initially (2 checked in [Priya, Nadia], 1 pending [Jordan])
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    // Find Jordan Wu's card container
    const jordanCard = screen.getByText('Jordan Wu').closest('.grid > div');
    expect(jordanCard).toBeInTheDocument();

    // 1. Check in Jordan Wu via QR Scanner Modal
    const scanBtn = screen.getByRole('button', { name: /Scan QR Code/i });
    await user.click(scanBtn);

    expect(await screen.findByTestId('volunteer-qr-scanner-modal')).toBeInTheDocument();

    // Switch to manual entry tab and submit 'p8' (Jordan Wu)
    await user.click(screen.getByRole('button', { name: /Manual ID Entry/i }));
    await user.type(screen.getByTestId('manual-checkin-input'), 'p8');
    await user.click(screen.getByTestId('manual-checkin-button'));

    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByRole('button', { name: /Done/i }));

    // Verify counter incremented to 3 / 3
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // Jordan's card now has "Undo Check-in" button
    const jordanUndoBtn = within(jordanCard as HTMLElement).getByRole('button', { name: /Undo Check-in/i });
    expect(jordanUndoBtn).toBeInTheDocument();

    // 2. Click "Undo Check-in" manually on Jordan's card
    await user.click(jordanUndoBtn);

    // Counter should decrement back to 2 / 3
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    // Jordan's card should now show "Check In"
    const jordanCheckInBtn = within(jordanCard as HTMLElement).getByRole('button', { name: /^Check In$/i });
    expect(jordanCheckInBtn).toBeInTheDocument();

    // 3. Click manual "Check In" on Jordan's card
    await user.click(jordanCheckInBtn);

    // Counter increments again to 3 / 3
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  test('scanning an attendee not in the current track roster does not corrupt roster list or counters', async () => {
    const user = userEvent.setup();
    renderDashboard();

    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    // Open scanner modal
    await user.click(screen.getByRole('button', { name: /Scan QR Code/i }));
    await user.click(screen.getByRole('button', { name: /Manual ID Entry/i }));

    // Check in valid external UUID not in novasphere roster
    await user.type(screen.getByTestId('manual-checkin-input'), '44444444-4444-4444-8888-444444444444');
    await user.click(screen.getByTestId('manual-checkin-button'));

    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
    expect(screen.getByText('External Attendee')).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByRole('button', { name: /Done/i }));

    // The local track roster counters should remain unaffected at 2 / 3
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  test('filtering roster by pending participants updates live when checked in via scanner', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Filter by "Pending" tab
    const pendingTab = screen.getByRole('button', { name: /^Pending \(/i });
    await user.click(pendingTab);

    // Jordan Wu should be visible initially under pending
    expect(screen.getByText('Jordan Wu')).toBeInTheDocument();

    // Check in Jordan Wu via scanner
    await user.click(screen.getByRole('button', { name: /Scan QR Code/i }));
    await user.click(screen.getByRole('button', { name: /Manual ID Entry/i }));
    await user.type(screen.getByTestId('manual-checkin-input'), 'p8');
    await user.click(screen.getByTestId('manual-checkin-button'));

    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Done/i }));

    // Jordan Wu should now be filtered OUT of the pending tab
    expect(screen.queryByText('Jordan Wu')).not.toBeInTheDocument();
    // Empty state should be visible for pending tab
    expect(screen.getByText('No participants match your current search or filter criteria.')).toBeInTheDocument();
  });
});
