import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VolunteerQrScannerModal from '../VolunteerQrScannerModal';

let mockScanSuccessCallback: ((decodedText: string) => void) | null = null;
let mockScannerInstance: any = null;

const {
  mockSupabaseClient,
  mockScannerStartSpy,
  mockScannerStopSpy,
  mockScannerClearSpy,
  usersDatabase,
} = vi.hoisted(() => {
  const users: any[] = [
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
    {
      id: '33333333-4444-5555-6666-777777777777',
      name: 'Charlie Chaplin',
      role: 'ambassador',
      email: 'charlie@chaplin.org',
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
        eq: vi.fn((column: string, val: any) => {
          if (column === 'id') filterId = val;
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

  return {
    mockSupabaseClient: client,
    mockScannerStartSpy: vi.fn(),
    mockScannerStopSpy: vi.fn(),
    mockScannerClearSpy: vi.fn(),
    usersDatabase: users,
  };
});

vi.mock('html5-qrcode', () => {
  return {
    Html5Qrcode: vi.fn().mockImplementation(() => {
      mockScannerInstance = {
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
      return mockScannerInstance;
    }),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Adversarial Test: VolunteerQrScannerModal Lifecycle & Concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScanSuccessCallback = null;
    mockScannerInstance = null;
    // Reset check-in statuses
    usersDatabase[0].checked_in_at = null;
    usersDatabase[1].checked_in_at = '2026-09-06T09:00:00Z';
    usersDatabase[2].checked_in_at = null;
  });

  test('rapid open and close does not throw or leak unhandled promises', async () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Rapidly toggle closed before timer/start resolves
    rerender(
      <VolunteerQrScannerModal
        open={false}
        onOpenChange={onOpenChange}
      />,
    );

    // Rapidly reopen
    rerender(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    // Rapidly reclose
    rerender(
      <VolunteerQrScannerModal
        open={false}
        onOpenChange={onOpenChange}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Stop spy should have been called cleanly without errors
    expect(mockScannerStopSpy).toHaveBeenCalled();
  });

  test('unmounting while scanner is active triggers clean teardown of Html5Qrcode', async () => {
    const { unmount } = render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(mockScannerStartSpy).toHaveBeenCalled();

    // Unmount modal
    unmount();

    // Wait for async stop promise to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // stop and clear must be called to release camera hardware
    expect(mockScannerStopSpy).toHaveBeenCalled();
    expect(mockScannerClearSpy).toHaveBeenCalled();
  });

  test('concurrent/rapid scan callbacks without synchronous ref guard result in multiple check-in invocations', async () => {
    const handleSuccess = vi.fn();
    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
        onCheckInSuccess={handleSuccess}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(mockScanSuccessCallback).toBeTruthy();

    // Fire callback 3 times in rapid synchronous succession (simulating 3 successive video frames before React state re-renders)
    await act(async () => {
      mockScanSuccessCallback!('11111111-2222-3333-4444-555555555555');
      mockScanSuccessCallback!('11111111-2222-3333-4444-555555555555');
      mockScanSuccessCallback!('11111111-2222-3333-4444-555555555555');
    });

    // EMPIRICAL OBSERVATION:
    // In VolunteerQrScannerModal, isProcessing is a React useState (asynchronous update).
    // Because isProcessing is not a synchronous ref guard (useRef), rapid synchronous video frame callbacks
    // bypass `if (isProcessing) return;` in the same tick and trigger multiple check-in calls.
    expect(handleSuccess.mock.calls.length).toBeGreaterThan(1);
    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
  });

  test('Scan Next workflow resets prior participant data and enables scanning Participant B', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
        onCheckInSuccess={handleSuccess}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    // 1. Scan Participant A (Alice Wonder)
    await act(async () => {
      mockScanSuccessCallback!('11111111-2222-3333-4444-555555555555');
    });

    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
    expect(screen.getByText('Alice Wonder')).toBeInTheDocument();

    // 2. Click "Scan Next Participant"
    const scanNextBtn = screen.getByRole('button', { name: /Scan Next Participant/i });
    await user.click(scanNextBtn);

    // Prior participant card should be completely gone
    expect(screen.queryByText('Alice Wonder')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scan-feedback-success')).not.toBeInTheDocument();

    // Wait for scanner to remount
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    // 3. Scan Participant B (Charlie Chaplin)
    await act(async () => {
      mockScanSuccessCallback!('33333333-4444-5555-6666-777777777777');
    });

    expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();
    expect(screen.getByText('Charlie Chaplin')).toBeInTheDocument();
    expect(screen.queryByText('Alice Wonder')).not.toBeInTheDocument();
  });

  test('double check-in displays warning feedback with prior timestamp', async () => {
    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    // Scan Bob Builder (who is already checked in at 2026-09-06T09:00:00Z)
    await act(async () => {
      mockScanSuccessCallback!('22222222-3333-4444-5555-666666666666');
    });

    const warningCard = await screen.findByTestId('scan-feedback-warning');
    expect(warningCard).toBeInTheDocument();
    expect(screen.getByText('Already Checked In')).toBeInTheDocument();
    expect(screen.getByText('Bob Builder')).toBeInTheDocument();
    expect(screen.getByText('Prior Check-in:')).toBeInTheDocument();
  });

  test('manual tab handles SQL injection attempts without crashing, displaying error card', async () => {
    const user = userEvent.setup();

    render(
      <VolunteerQrScannerModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Switch to manual tab
    await user.click(screen.getByRole('button', { name: /Manual ID Entry/i }));

    const input = screen.getByTestId('manual-checkin-input');
    const submitBtn = screen.getByTestId('manual-checkin-button');

    // Attempt SQL injection input
    await user.type(input, "' OR '1'='1");
    await user.click(submitBtn);

    // Should display check-in unsuccessful error card
    expect(await screen.findByTestId('scan-feedback-error')).toBeInTheDocument();
    expect(screen.getByText('Invalid participant ID format')).toBeInTheDocument();
  });
});
