import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QrPassModal from '../QrPassModal';

describe('Adversarial Test: QrPassModal Stress-Testing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('handles Unicode, accented names, and single-word names without crashing initials', () => {
    const edgeCases = [
      { name: 'Éléonore François', expectedInitials: 'ÉF' },
      { name: '李 小龙', expectedInitials: '李小' },
      { name: 'Madonna', expectedInitials: 'M' },
      { name: '   Spaces   Around   ', expectedInitials: 'SA' },
      { name: '123 456', expectedInitials: '14' },
      { name: '', expectedInitials: 'P' },
    ];

    for (const { name, expectedInitials } of edgeCases) {
      const { unmount } = render(
        <QrPassModal
          open={true}
          onOpenChange={vi.fn()}
          profile={{
            id: 'c8d9e234-5b6a-4f11-9a2c-7b8901234567',
            name,
            role: 'participant',
            email: 'test@example.com',
          }}
        />,
      );

      // Verify initials rendered
      expect(screen.getByText(expectedInitials)).toBeInTheDocument();
      unmount();
    }
  });

  test('gracefully handles empty/null profile fields without throwing', () => {
    render(
      <QrPassModal
        open={true}
        onOpenChange={vi.fn()}
        profile={{
          id: undefined,
          name: undefined,
          role: undefined,
          email: undefined,
          checked_in_at: undefined,
        }}
      />,
    );

    // Fallback name is 'Participant' and role badge is 'Participant'
    const participantTexts = screen.getAllByText('Participant');
    expect(participantTexts.length).toBeGreaterThanOrEqual(2);
    // Displays 'No user ID available' when ID is missing
    expect(screen.getByText('No user ID available')).toBeInTheDocument();
    expect(screen.getByText('Pending Check-in')).toBeInTheDocument();
  });

  test('handles clipboard failure gracefully without uncaught rejection', async () => {
    const user = userEvent.setup();

    // Mock navigator.clipboard.writeText throwing an error (e.g. permission denied)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard permission denied')),
      },
      configurable: true,
      writable: true,
    });

    render(
      <QrPassModal
        open={true}
        onOpenChange={vi.fn()}
        profile={{
          id: 'c8d9e234-5b6a-4f11-9a2c-7b8901234567',
          name: 'Test User',
          role: 'participant',
        }}
      />,
    );

    const copyBtn = screen.getByRole('button', { name: /Copy User ID/i });
    expect(copyBtn).toBeInTheDocument();

    // Should catch the error and not crash
    await user.click(copyBtn);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  test('handles extremely long names and IDs without breaking SVG rendering', () => {
    const longName = 'A'.repeat(500);
    const longId = '12345678-1234-1234-1234-123456789abc';

    render(
      <QrPassModal
        open={true}
        onOpenChange={vi.fn()}
        profile={{
          id: longId,
          name: longName,
          role: 'participant',
        }}
      />,
    );

    const qrContainer = screen.getByTestId('qr-code-container');
    expect(qrContainer.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  test('handles malformed timestamp string without crashing the UI', () => {
    render(
      <QrPassModal
        open={true}
        onOpenChange={vi.fn()}
        profile={{
          id: 'c8d9e234-5b6a-4f11-9a2c-7b8901234567',
          name: 'Corrupted Timestamp User',
          role: 'participant',
          checked_in_at: 'garbage_timestamp_string',
        }}
      />,
    );

    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText(/Invalid Date/i)).toBeInTheDocument();
  });
});
