import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import LineupPreview, { SLIDE_MS } from '../LineupPreview';

vi.mock('../../components/LineupSections', () => ({ LineupBody: ({ id }: { id: string }) => <div>{id} copy</div> }));

function Lineup() {
  const { state } = useLocation();
  return <p>Lineup page, section {(state as { scrollTo?: string } | null)?.scrollTo}</p>;
}

test('tabs pick the slide, and its View button opens that section of the Lineup page', async () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<LineupPreview />} />
        <Route path="/lineup" element={<Lineup />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Keynote', 'Sponsors', 'Experts', 'Team']);
  expect(screen.getByRole('button', { name: /View keynote/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Sponsors' }));
  expect(screen.getByRole('tab', { name: 'Sponsors' })).toHaveAttribute('aria-selected', 'true');
  await userEvent.click(screen.getByRole('button', { name: /View sponsors/ }));
  expect(screen.getByText('Lineup page, section sponsors')).toBeInTheDocument();
});

test('advances every 6 seconds while on screen, even with the pointer over it', () => {
  vi.useFakeTimers();
  // Report every observed element as on screen.
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    disconnect() {}
  });
  render(<MemoryRouter><LineupPreview /></MemoryRouter>);
  fireEvent.mouseEnter(document.getElementById('lineup')!);
  expect(screen.getByRole('tab', { name: 'Keynote' })).toHaveAttribute('aria-selected', 'true');
  act(() => vi.advanceTimersByTime(SLIDE_MS));
  expect(screen.getByRole('tab', { name: 'Sponsors' })).toHaveAttribute('aria-selected', 'true');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
