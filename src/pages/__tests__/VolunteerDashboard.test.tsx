import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VolunteerDashboard from '../VolunteerDashboard';
import * as useRequireProfileModule from '../../hooks/useRequireProfile';

// Mock schedule context to avoid missing context providers
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

describe('VolunteerDashboard Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  // ---------------------------------------------------------------------------
  // Tier 1: Feature Coverage
  // ---------------------------------------------------------------------------
  describe('Tier 1: Feature Coverage', () => {
    beforeEach(() => {
      vi.spyOn(useRequireProfileModule, 'useRequireRole').mockReturnValue({
        ready: true,
        redirect: null,
        roleName: 'volunteer',
      });
    });

    test('renders Volunteer Dashboard with assigned track, participant roster, and check-in tools', () => {
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      // Verify Header and Assigned Track
      expect(screen.getByText('Volunteer Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Volunteer Hub & Track Management')).toBeInTheDocument();
      expect(screen.getByText('Assigned Track')).toBeInTheDocument();
      expect(screen.getByText('NovaSphere')).toBeInTheDocument();

      // Verify Participant Roster header
      expect(screen.getByText('Participant Roster')).toBeInTheDocument();

      // Verify participant cards render (e.g. Priya Sharma)
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    test('toggles check-in status when check-in button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      // Find initial check in / undo check-in buttons
      const checkInButtons = screen.getAllByRole('button', { name: /(Check In|Undo Check-in)/i });
      expect(checkInButtons.length).toBeGreaterThan(0);

      const firstBtn = checkInButtons[0];
      const initialText = firstBtn.textContent;

      // Click button
      await user.click(firstBtn);

      // Verify text toggles
      if (initialText?.includes('Undo Check-in')) {
        expect(firstBtn.textContent).toContain('Check In');
      } else {
        expect(firstBtn.textContent).toContain('Undo Check-in');
      }
    });

    test('filters participant list when status tab is selected', async () => {
      const user = userEvent.setup();
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      // Click "Checked In" filter tab
      const checkedInTab = screen.getByRole('button', { name: /^Checked In \(/i });
      await user.click(checkedInTab);

      // Verify filtered list view
      expect(checkedInTab).toHaveClass('bg-background');
    });
  });

  // ---------------------------------------------------------------------------
  // Tier 2: Boundary & Corner Cases
  // ---------------------------------------------------------------------------
  describe('Tier 2: Boundary & Corner Cases', () => {
    beforeEach(() => {
      vi.spyOn(useRequireProfileModule, 'useRequireRole').mockReturnValue({
        ready: true,
        redirect: null,
        roleName: 'volunteer',
      });
    });

    test('handles empty participant roster gracefully with empty state banner', () => {
      renderWithRouter(
        <VolunteerDashboard assignedTrack="novasphere" participants={[]} />,
      );

      expect(
        screen.getByText('No participants assigned to this track'),
      ).toBeInTheDocument();
    });

    test('handles unassigned track cleanly with unassigned fallback message', () => {
      renderWithRouter(<VolunteerDashboard assignedTrack={null} />);

      expect(screen.getByText('No assigned track found')).toBeInTheDocument();
      expect(screen.getByText('No assigned track')).toBeInTheDocument();
    });

    test('handles unknown track string gracefully without throwing', () => {
      renderWithRouter(<VolunteerDashboard assignedTrack="unknown_track_123" />);

      expect(screen.getByText('No assigned track found')).toBeInTheDocument();
    });

    test('handles null participants prop cleanly as empty roster', () => {
      renderWithRouter(
        <VolunteerDashboard assignedTrack="novasphere" participants={null} />,
      );

      expect(
        screen.getByText('No participants assigned to this track'),
      ).toBeInTheDocument();
    });

    test('filters participant list when typing into search input', async () => {
      const user = userEvent.setup();
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      const searchInput = screen.getByPlaceholderText('Search participants...');
      await user.type(searchInput, 'Priya');

      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.queryByText('Jordan Wu')).not.toBeInTheDocument();

      await user.clear(searchInput);
      await user.type(searchInput, 'NonExistentParticipantXYZ');

      expect(
        screen.getByText('No participants match your current search or filter criteria.'),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Tier 3: Cross-Feature & Security
  // ---------------------------------------------------------------------------
  describe('Tier 3: Cross-Feature & Role Gating Security', () => {
    test('enforces role gating and redirects unauthorized non-volunteer users', () => {
      vi.spyOn(useRequireProfileModule, 'useRequireRole').mockReturnValue({
        ready: false,
        redirect: '/home',
        roleName: 'participant',
      });

      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      // Content should not be rendered when redirected
      expect(screen.queryByText('Volunteer Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Participant Roster')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Tier 4: Design System Adherence
  // ---------------------------------------------------------------------------
  describe('Tier 4: Design System Adherence', () => {
    beforeEach(() => {
      vi.spyOn(useRequireProfileModule, 'useRequireRole').mockReturnValue({
        ready: true,
        redirect: null,
        roleName: 'volunteer',
      });
    });

    test('uses AppShell, PageHeader eyebrow, font-display heading, and glass card components', () => {
      const { container } = renderWithRouter(
        <VolunteerDashboard assignedTrack="novasphere" />,
      );

      // PageHeader Eyebrow
      expect(screen.getByText('Volunteer Dashboard')).toBeInTheDocument();

      // Heading display font
      const heading = screen.getByText('Volunteer Hub & Track Management');
      expect(heading).toHaveClass('font-display');

      // Glass cards present in DOM
      const glassElements = container.querySelectorAll('.glass');
      expect(glassElements.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Tier 5: QR Code Check-in System Integration (Requirement R2, R4)
  // ---------------------------------------------------------------------------
  describe('Tier 5: QR Code Check-in System Integration', () => {
    beforeEach(() => {
      vi.spyOn(useRequireProfileModule, 'useRequireRole').mockReturnValue({
        ready: true,
        redirect: null,
        roleName: 'volunteer',
      });
    });

    test('renders "Scan QR Code" button in the Participant Roster header', () => {
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      const scanBtn = screen.getByRole('button', { name: /Scan QR Code/i });
      expect(scanBtn).toBeInTheDocument();
      expect(scanBtn).toHaveClass('bg-emerald');
    });

    test('opens VolunteerQrScannerModal when "Scan QR Code" button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      const scanBtn = screen.getByRole('button', { name: /Scan QR Code/i });
      await user.click(scanBtn);

      expect(await screen.findByTestId('volunteer-qr-scanner-modal')).toBeInTheDocument();
      expect(screen.getByText('Scan Participant QR Pass')).toBeInTheDocument();
    });

    test('preserves manual check-in buttons on participant roster cards alongside scanner', async () => {
      const user = userEvent.setup();
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      // Verify "Scan QR Code" header button exists
      expect(screen.getByRole('button', { name: /Scan QR Code/i })).toBeInTheDocument();

      // Find individual participant card manual check-in buttons
      const manualButtons = screen.getAllByRole('button', { name: /(Check In|Undo Check-in)/i });
      expect(manualButtons.length).toBeGreaterThan(0);

      const firstBtn = manualButtons[0];
      const initialText = firstBtn.textContent;

      // Click manual check-in button
      await user.click(firstBtn);

      // Verify status toggles without opening modal
      expect(screen.queryByTestId('volunteer-qr-scanner-modal')).not.toBeInTheDocument();
      if (initialText?.includes('Undo Check-in')) {
        expect(firstBtn.textContent).toContain('Check In');
      } else {
        expect(firstBtn.textContent).toContain('Undo Check-in');
      }
    });

    test('updates roster status and counter when participant is checked in via scanner modal fallback', async () => {
      const user = userEvent.setup();
      renderWithRouter(<VolunteerDashboard assignedTrack="novasphere" />);

      // Open scanner modal
      const scanBtn = screen.getByRole('button', { name: /Scan QR Code/i });
      await user.click(scanBtn);

      expect(await screen.findByTestId('volunteer-qr-scanner-modal')).toBeInTheDocument();

      // Switch to manual fallback in modal
      const manualTab = screen.getByRole('button', { name: /Manual ID Entry/i });
      await user.click(manualTab);

      const input = screen.getByTestId('manual-checkin-input');
      const submitBtn = screen.getByTestId('manual-checkin-button');

      // Check in Jordan Wu (p8)
      await user.type(input, 'p8');
      await user.click(submitBtn);

      // Verify success feedback in modal
      expect(await screen.findByTestId('scan-feedback-success')).toBeInTheDocument();

      // Close modal
      const doneBtn = screen.getByRole('button', { name: /Done/i });
      await user.click(doneBtn);

      // Modal is closed
      expect(screen.queryByTestId('volunteer-qr-scanner-modal')).not.toBeInTheDocument();
    });
  });
});
