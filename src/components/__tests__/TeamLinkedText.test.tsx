import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamLinkedText from '../TeamLinkedText';

test('renders clickable track names without changing any paragraph characters', () => {
  const text = "I lead Engineering Exhibits & CADathon. I'm in 11th grade.";
  render(
    <MemoryRouter initialEntries={['/summit-27/team']}>
      <p data-testid="bio"><TeamLinkedText text={text} mentions={[
        { text: 'Engineering Exhibits', target: 'engineering-exhibits' },
        { text: 'CADathon', target: 'cadathon' },
      ]} /></p>
    </MemoryRouter>,
  );
  expect(screen.getByTestId('bio').textContent).toBe(text);
  expect(screen.getByRole('link', { name: 'Engineering Exhibits' })).toHaveAttribute('href', '/team/tracks/engineering-exhibits');
  expect(screen.getByRole('link', { name: 'CADathon' })).toHaveAttribute('href', '/team/tracks/cadathon');
});

test('on the public page a discipline opens the landing Disciplines section; in the portal, the discipline itself', () => {
  const mentions = [{ text: 'BioSphere', target: 'biosphere' as const }];
  const { unmount } = render(
    <MemoryRouter initialEntries={['/lineup']}><TeamLinkedText text="I lead BioSphere." mentions={mentions} /></MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'BioSphere' })).toHaveAttribute('href', '/');
  unmount();
  render(<MemoryRouter initialEntries={['/summit-27/team']}><TeamLinkedText text="I lead BioSphere." mentions={mentions} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'BioSphere' })).toHaveAttribute('href', '/disciplines?verse=biosphere');
});
