import { afterEach, describe, expect, test } from 'vitest';
import { countWord, replaceDisciplines, USER_DISCIPLINES, NEW_DISCIPLINE_COLOR } from '../disciplines';
import { vibeFor, EMERALD_VIBE } from '../verseVibes';
import { DISCIPLINE_ICONS } from '@/components/icons';
import { bannerFor, type Announcement } from '../announcements';
import { bookedMinutes, formatMinutes, openSessionsThatFit } from '../suggested';
import { quoteForDay, QUOTES } from '../../components/home/QuoteCard';
import { detailLabel } from '../profileFields';
import type { Session } from '../sessions';

const bundled = [...USER_DISCIPLINES];
afterEach(() => { USER_DISCIPLINES.splice(0, USER_DISCIPLINES.length, ...bundled); });

describe('disciplines from the database', () => {
  test('take the rows in order, keep the six colors, trim taglines, and give a new one emerald', () => {
    replaceDisciplines([
      { id: 'civicverse', name: 'CivicVerse', tagline: 'Mock Trial ', icon: 'gavel' },
      { id: 'healthverse', name: 'HealthVerse', tagline: 'Medicine', icon: 'science' },
    ]);
    expect(USER_DISCIPLINES).toEqual([
      { name: 'civicverse', label: 'CivicVerse', description: 'Mock Trial', color: '#F97316', icon: 'gavel' },
      { name: 'healthverse', label: 'HealthVerse', description: 'Medicine', color: NEW_DISCIPLINE_COLOR, icon: 'science' },
    ]);
  });

  test('a new discipline gets the emerald world with its own icon', () => {
    replaceDisciplines([{ id: 'healthverse', name: 'HealthVerse', tagline: '', icon: 'science' }]);
    const vibe = vibeFor('healthverse');
    expect(vibe.background).toBe(EMERALD_VIBE.background);
    expect(vibe.icon).toBe(DISCIPLINE_ICONS.science);
  });

  test('headings count in words', () => {
    expect(countWord(6)).toBe('six');
    expect(countWord(7)).toBe('seven');
    expect(countWord(20)).toBe('20');
  });
});

describe('the new-announcement banner', () => {
  const post = (a: Partial<Announcement>): Announcement => ({
    id: 'a', title: 'Room change', body: 'Lab moved', author: 'Ms. Lee', createdAt: '2026-11-13T10:00:00Z', ...a,
  } as Announcement);
  const me = { userId: 'me', isAdmin: false, reaches: (id: string) => id === 'techverse' };

  test('shows a post that reaches me, and opens News', () => {
    expect(bannerFor([post({})], me)).toEqual({ title: 'Room change', body: 'Lab moved', to: '/announcements' });
  });

  test('nothing for my own post or a discipline I am not in', () => {
    expect(bannerFor([post({ authorId: 'me' })], me)).toBeNull();
    expect(bannerFor([post({ disciplineId: 'imaginex' })], me)).toBeNull();
  });

  test('a personal notice for me opens the bell; one for someone else shows nothing', () => {
    expect(bannerFor([post({ targetUserId: 'me' })], me)?.to).toBe('/notifications');
    expect(bannerFor([post({ targetUserId: 'you' })], me)).toBeNull();
  });

  test('admins see who sent a discipline post where', () => {
    const admin = { ...me, isAdmin: true, reaches: () => true };
    expect(bannerFor([post({ disciplineId: 'techverse' })], admin)).toEqual({
      title: 'Ms. Lee sent an announcement to the TechVerse discipline', body: 'Room change', to: '/announcements',
    });
  });

  test('picks the newest of several', () => {
    const older = post({ id: 'o', title: 'Old', createdAt: '2026-11-13T09:00:00Z' });
    expect(bannerFor([older, post({})], me)?.title).toBe('Room change');
  });
});

describe("the schedule's day summary", () => {
  const s = (id: string, start: string, end: string, more: Partial<Session> = {}) =>
    ({ id, title: id, track: 't', start, end, capacity: 10, enrolled: 0, ...more }) as Session;

  test('formats minutes like the app', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 hr');
    expect(formatMinutes(90)).toBe('1 hr 30 min');
  });

  test('sums booked time and counts open sessions that fit', () => {
    const all = [s('a', '10:00', '11:00'), s('b', '10:30', '11:30'), s('c', '13:00', '14:30'), s('full', '15:00', '16:00', { enrolled: 10 })];
    expect(bookedMinutes([all[0]])).toBe(60);
    expect(openSessionsThatFit(all, new Set(['a']))).toBe(1);
  });
});

describe('Home quote', () => {
  test('changes by day of the year, like the app', () => {
    expect(quoteForDay(new Date(2026, 0, 1))).toBe(QUOTES[0]);
    expect(quoteForDay(new Date(2026, 0, 2))).toBe(QUOTES[1]);
    expect(quoteForDay(new Date(2026, 0, 8))).toBe(QUOTES[0]);
  });
});

describe('roster detail labels', () => {
  test('use the sign-up field label without "(optional)"', () => {
    expect(detailLabel('expertise')).toBe('Area of expertise');
    expect(detailLabel('student_id')).toBe('Student ID');
    expect(detailLabel('t_shirt')).toBe('T shirt');
  });
});
