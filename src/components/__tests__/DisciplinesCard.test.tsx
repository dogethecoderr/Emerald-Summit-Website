import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { USER_DISCIPLINES } from '../../models/disciplines';
import DisciplinesCard from '../home/DisciplinesCard';

vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

test('one box per discipline opens it in Explore, plus a link to all of Explore', () => {
  render(<MemoryRouter><DisciplinesCard /></MemoryRouter>);
  const boxes = within(screen.getByRole('list')).getAllByRole('link');
  expect(boxes).toHaveLength(USER_DISCIPLINES.length);
  expect(boxes[0]).toHaveAttribute('href', `/disciplines?verse=${USER_DISCIPLINES[0].name}`);
  expect(boxes[0]).toHaveTextContent(USER_DISCIPLINES[0].label);
  expect(screen.getByRole('link', { name: /Explore all disciplines/ })).toHaveAttribute('href', '/disciplines');
});
