import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Summit27Page from '../Summit27Page';
import LineupPage from '../LineupPage';
import SponsorTiers from '../../components/SponsorTiers';
import LandingNav from '../../components/LandingNav';
import { navItemsForRole } from '../../components/AppShell';
import { EAF_VOLUNTEER_URL } from '../../components/home/AboutSections';
import { SPONSOR_TIERS } from '../../models/sponsors';
import { EXPERTS_EMPTY } from '../../components/ExpertsDirectory';
import { TEAM_MEMBERS } from '../../models/team';

const state = vi.hoisted(() => ({
  guard: { ready: true, redirect: null as string | null },
}));
vi.mock('../../components/AppShell', async (importActual) => ({
  ...(await importActual<typeof import('../../components/AppShell')>()),
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../services/experts', () => ({ fetchPublicExperts: () => Promise.resolve([]) }));
vi.mock('../../hooks/useRequireProfile', () => ({ useRequireProfile: () => state.guard }));

beforeEach(() => {
  state.guard = { ready: true, redirect: null };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/summit-27/:tab" element={<Summit27Page />} />
        <Route path="/roles" element={<p>Roles page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Summit '27 page", () => {
  test('is signed-in only: a visitor is sent to sign in', () => {
    state.guard = { ready: false, redirect: '/roles' };
    renderAt('/summit-27/sponsors');
    expect(screen.getByText('Roles page')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Sponsor tiers, highest first' })).not.toBeInTheDocument();
  });

  test("the landing navbar's Summit '27 menu opens on hover or click and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LandingNav /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const summit = within(nav).getByRole('button', { name: "Summit '27" });
    expect(summit).toHaveAttribute('aria-expanded', 'false');
    await user.hover(summit);
    expect(summit).toHaveAttribute('aria-expanded', 'true');
    // A click after the hover keeps it open rather than toggling it shut.
    await user.click(summit);
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(
      ['About', 'Disciplines', "Summit '27", 'Keynote', 'Sponsors', 'Experts', 'Team', 'FAQ', 'Donate', 'Contact'],
    );
    await user.keyboard('{Escape}');
    expect(summit).toHaveAttribute('aria-expanded', 'false');
    expect(summit).toHaveFocus();
  });

  test("the landing navbar groups Keynote, Sponsors, Experts and Team under Summit '27; Team opens the Lineup page", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingNav />} />
          <Route path="/lineup" element={<LineupPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(
      ['About', 'Disciplines', "Summit '27", 'FAQ', 'Donate', 'Contact'],
    );
    await user.click(within(nav).getByRole('button', { name: "Summit '27" }));
    // fireEvent: user-event's pointer move between buttons reads as leaving the menu in jsdom (no relatedTarget), closing it.
    fireEvent.click(within(nav).getByRole('button', { name: 'Team' }));
    // All four on one page, in the Lineup's order.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Keynote', 'Sponsors', 'Experts', 'Team']);
    expect(await screen.findByText(EXPERTS_EMPTY)).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
    expect(['Event Organizers', 'Developers', 'Ambassadors', 'EAF Team'].flatMap((name) => within(screen.getByRole('list', { name })).getAllByRole('listitem'))).toHaveLength(TEAM_MEMBERS.length);
    expect(screen.getByRole('heading', { name: 'Deep Shah' })).toBeInTheDocument();
  });

  test('the sidebar has one Summit \'27 tab, opening Keynote, for every role', () => {
    for (const role of ['participant', 'attendee', 'expert', 'volunteer', 'admin']) {
      const items = navItemsForRole(role).filter((n) => n.to.startsWith('/summit-27'));
      expect(items.map((n) => [n.label, n.to, n.opens])).toEqual([["Summit '27", '/summit-27', '/summit-27/keynote']]);
    }
  });

  test('subtabs switch between keynote, team, experts and sponsors, with Donate on each', async () => {
    renderAt('/summit-27/keynote');
    expect(screen.getByText(/keynote speaker will be announced soon/)).toBeInTheDocument();
    expect(screen.getByText('Saturday, January 23, 2027 · 9 AM to 5 PM · Emerald High School, Dublin, CA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Donate/ })).toBeInTheDocument();

    const tabs = screen.getByRole('navigation', { name: "Summit '27" });
    await userEvent.click(within(tabs).getByRole('link', { name: /Team/ }));
    expect(screen.getByRole('heading', { level: 1, name: "Summit '27" })).toBeInTheDocument();
    expect(['Event Organizers', 'Developers', 'Ambassadors', 'EAF Team'].flatMap((name) => within(screen.getByRole('list', { name })).getAllByRole('listitem'))).toHaveLength(TEAM_MEMBERS.length);
    expect(screen.getByRole('heading', { name: 'Guhan Bala' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /CADathon/i })[0]).toHaveAttribute('href', '/team/tracks/cadathon');

    // Experts fills in from the database; with none yet it says so.
    await userEvent.click(within(tabs).getByRole('link', { name: /Experts/ }));
    expect(await screen.findByText(EXPERTS_EMPTY)).toBeInTheDocument();

    await userEvent.click(within(tabs).getByRole('link', { name: /Sponsors/ }));
    const tiers = screen.getByRole('list', { name: 'Sponsor tiers, highest first' });
    expect(within(tiers).getAllByRole('listitem').filter((li) => li.parentElement === tiers)).toHaveLength(SPONSOR_TIERS.length);
    expect(screen.getByRole('button', { name: /Donate/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volunteer with EAF/ })).toHaveAttribute('href', EAF_VOLUNTEER_URL);
  });

  test('an unknown subtab opens Keynote', () => {
    renderAt('/summit-27/nope');
    expect(screen.getByRole('heading', { level: 1, name: "Summit '27" })).toBeInTheDocument();
    expect(screen.getByText(/keynote speaker will be announced soon/)).toBeInTheDocument();
  });

  test('sponsors show in their tier, and every tier has a spot for your company logo', () => {
    render(<SponsorTiers sponsors={[{ name: 'Acme', tier: 'Pillar', url: 'https://acme.test', logo: '/acme.png' }]} />);
    const pillar = screen.getByRole('list', { name: 'Pillar sponsors' });
    expect(within(pillar).getByRole('img', { name: 'Acme' })).toBeInTheDocument();
    const spots = screen.getAllByRole('button', { name: /^Your company logo could go here/ });
    expect(spots.map((b) => b.getAttribute('aria-label')!.split('become a ')[1])).toEqual(
      SPONSOR_TIERS.map((t) => `${t.name} sponsor`),
    );
  });
});
