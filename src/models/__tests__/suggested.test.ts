import { describe, expect, test } from 'vitest';
import type { Session } from '../sessions';
import { suggestedSessions } from '../suggested';

const session = (id: string, start: string, end: string, more: Partial<Session> = {}): Session => ({
  id, title: id, track: 'techverse', speaker: '', time: start, location: '', duration: '60 min', description: '',
  capacity: 10, enrolled: 0, start, end, ...more,
} as Session);

describe('suggestedSessions', () => {
  const current = session('current', '10:00', '11:00');

  test('same discipline only, not full, not on my day, earliest first', () => {
    const all = [
      current,
      session('later', '14:00', '15:00'),
      session('earlier', '09:00', '10:00'),
      session('other-discipline', '12:00', '13:00', { track: 'artverse' }),
      session('full', '12:00', '13:00', { enrolled: 10 }),
      session('mine', '16:00', '17:00'),
    ];
    expect(suggestedSessions(current, all, new Set(['mine'])).map((s) => s.id)).toEqual(['earlier', 'later']);
  });

  test("leaves out sessions that clash with something I'm registered for or managing", () => {
    const all = [
      current,
      session('managing', '13:00', '14:00'),
      session('clash', '13:30', '14:30'),
      session('touching', '14:00', '15:00'),
    ];
    expect(suggestedSessions(current, all, new Set(['managing'])).map((s) => s.id)).toEqual(['touching']);
  });
});
