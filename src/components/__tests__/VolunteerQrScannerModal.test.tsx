import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VolunteerQrScannerModal from '../VolunteerQrScannerModal';

let mockScanSuccessCallback: ((decodedText: string) => void) | null = null;

const {
  mockSupabaseClient,
  mockScannerStartSpy,
  mockScannerStopSpy,
  mockScannerClearSpy,
} = vi.hoisted(() => {
  const users = [
    {
      id: '11111111-2222-3333-4444-555555555555',
      name: 'Alice Wonder',
      role: 'participant',
      email: 'alice@wonder.org',
      checked_in_at: null,
    },
    {
      id: '22222222-3333-4444-5555-666666666666',
      name: 'Bob Builder',
      role: 'participant',
      email: 'bob@builder.org',
      checked_in_at: '2026-09-06T09:00:00Z',
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
        eq: vi.fn((column: string, val: any) => {
          if (column === 'id') filterId = val;
          return builder;
        }),
        single: vi.fn(async () => {
          const user = users.find((u) => u.id === filterId);
          if (!user) return { data: null, error: { message: 'User not found' } };
          if (updatePayload) Object.assign(user, updatePayload);
          return { data: { ...user }, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          const user = users.find((u) => u.id === filterId);
          if (!user) return { data: null, error: null };
          if (updatePayload) Object.assign(user, updatePayload);
          return { data: { ...user }, error: null };
        }),
      };
      return builder;
    }),
  };

  return {
    mockSupabaseClient: client,
    mockScannerStartSpy: vi.fn(),
    mockScannerStopSpy: vi.fn(),
    mockScannerClearSpy: vi.fn(),
  };
});

vi.mock('html5-qrcode', () => {
  return {
    Html5Qrcode: vi.fn().mockImplementation(() => {
      return {
        isScanning: true,
        start: mockScannerStartSpy.mockImplementation(
          (_camera: any, _config: any, onScanSuccess: (text: string) => void) => {
            mockScanSuccessCallback = onScanSuccess;
            return Promise.resolve();
          },
        ),
        stop: mockScannerStopSpy.mockResolvedValue(undefined),
        clear: mockScannerClearSpy.mockReturnValue(undefined),
      };
    }),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('VolunteerQrScannerModal Component Suite (Requirement R2 & R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScanSuccessCallback = null;
  });

  test('renders scanner modal with camera container, tab controls, and header', async () => {
    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Scan Participant QR Pass')).toBeInTheDocument();
    expect(screen.getByText('Volunteer Check-in Scanner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Camera Scanner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manual ID Entry/i })).toBeInTheDocument();
    expect(screen.getByTestId('qr-reader-container')).toBeInTheDocument();
  });

  test('successfully processes camera scan of a valid participant UUID', async () => {
    const handleSuccess = vi.fn();
    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
        onCheckInSuccess={handleSuccess}
      />,
    );

    // Wait for scanner to mount and register callback
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(mockScanSuccessCallback).toBeTruthy();

    // Trigger mock scan
    await act(async () => {
      mockScanSuccessCallback!('11111111-2222-3333-4444-555555555555');
    });

    // Check success feedback card
    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
    expect(screen.getByText('Check-in Confirmed!')).toBeInTheDocument();
    expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
    expect(screen.getByText('alice@wonder.org')).toBeInTheDocument();
    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '11111111-2222-3333-4444-555555555555',
        name: 'Alice Wonder',
      }),
    );
  });

  test('shows warning feedback when participant is already checked in', async () => {
    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(mockScanSuccessCallback).toBeTruthy();

    // Trigger mock scan with already checked-in participant
    await act(async () => {
      mockScanSuccessCallback!('22222222-3333-4444-5555-666666666666');
    });

    expect(await screen.findByTestId('scan-feedback-warning')).toBeInTheDocument();
    expect(screen.getByText('Already Checked In')).toBeInTheDocument();
    expect(screen.getByText('Bob Builder')).toBeInTheDocument();
  });

  test('shows error feedback when QR code has an invalid format', async () => {
    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(mockScanSuccessCallback).toBeTruthy();

    // Trigger scan with invalid string
    await act(async () => {
      mockScanSuccessCallback!('invalid_format_xyz_123');
    });

    expect(await screen.findByTestId('scan-feedback-error')).toBeInTheDocument();
    expect(screen.getByText('Check-in Unsuccessful')).toBeInTheDocument();
    expect(
      screen.getByText('Invalid participant ID format'),
    ).toBeInTheDocument();
  });

  test('allows checking in via Manual ID Entry tab fallback', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
        onCheckInSuccess={handleSuccess}
      />,
    );

    // Switch to manual entry tab
    const manualTab = screen.getByRole('button', { name: /Manual ID Entry/i });
    await user.click(manualTab);

    const input = screen.getByTestId('manual-checkin-input');
    const submitBtn = screen.getByTestId('manual-checkin-button');

    expect(input).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Type mock person p8 (Jordan Wu)
    await user.type(input, 'p8');
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    // Verify success feedback
    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
    expect(screen.getByText('Jordan Wu')).toBeInTheDocument();
    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jordan Wu',
      }),
    );
  });

  test('resets result card when clicking "Scan Next Participant"', async () => {
    const user = userEvent.setup();

    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    // Trigger scan with invalid string to get error card
    await act(async () => {
      mockScanSuccessCallback!('invalid_qr_test');
    });

    expect(await screen.findByTestId('scan-feedback-error')).toBeInTheDocument();

    const scanNextBtn = screen.getByRole('button', { name: /Scan Next Participant/i });
    await user.click(scanNextBtn);

    // Error card should disappear, returning to scanner state
    expect(screen.queryByTestId('scan-feedback-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('qr-reader-container')).toBeInTheDocument();
  });
});
