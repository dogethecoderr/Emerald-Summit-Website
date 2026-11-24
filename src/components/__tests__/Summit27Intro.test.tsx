import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import Summit27IntroHost, { playSummit27Intro } from '../Summit27Intro';

beforeEach(() => sessionStorage.clear());

test('without the host mounted, the navigation runs straight away and the intro stays unplayed', () => {
  const go = vi.fn();
  playSummit27Intro(go);
  expect(go).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('summit27-intro-played')).toBeNull();
});

test('the first call of the session goes through the intro, later ones navigate directly', () => {
  render(<MemoryRouter><Summit27IntroHost /></MemoryRouter>);
  const first = vi.fn();
  // jsdom has no Element.animate, so the intro ends at once and runs the navigation.
  act(() => playSummit27Intro(first));
  expect(first).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('summit27-intro-played')).toBe('1');
  const second = vi.fn();
  playSummit27Intro(second);
  expect(second).toHaveBeenCalledTimes(1);
});
