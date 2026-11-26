import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import LineupPreview from '../LineupPreview';

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
