import { afterEach, describe, expect, it } from 'vitest';
import { mockVolunteerRoster } from '../volunteerRoster';
import {
  checkInDemoPerson,
  getDemoPeople,
  getDemoSessions,
  getDemoSessionRegistrations,
  setDemoSessionRegistration,
  undoDemoCheckIn,
} from '../offlineDemo';

describe('offline demo state', () => {
  afterEach(() => {
    for (const id of ['p12', 'p13']) {
      const person = getDemoPeople().find((candidate) => candidate.id === id);
      if (person?.status === 'checkedIn') undoDemoCheckIn(id, 'p10');
    }
    const registration = getDemoSessionRegistrations('p8')
      .find((item) => item.session_id === 's2');
    if (registration) setDemoSessionRegistration('s2', 'p8', null);
  });

  it('enforces track-volunteer limits while front desk can check in anyone', () => {
    expect(() => checkInDemoPerson('p12', 'p11')).toThrow(
      'This person is not in your discipline.',
    );

    const result = checkInDemoPerson('p13', 'p11');
    expect(result.alreadyCheckedIn).toBe(false);
    expect(result.person.status).toBe('checkedIn');
    undoDemoCheckIn('p13', 'p10');

    const frontDeskResult = checkInDemoPerson('p12', 'p10');
    expect(frontDeskResult.person.status).toBe('checkedIn');
  });

  it('shares dual-role participant check-in state across their registered tracks', () => {
    checkInDemoPerson('p12', 'p12');
    expect(mockVolunteerRoster('techverse').find((person) => person.id === 'p12')?.status)
      .toBe('checkedIn');
    expect(mockVolunteerRoster('civicverse').find((person) => person.id === 'p12')?.status)
      .toBe('checkedIn');
  });

  it('updates schedule registrations and session capacity in shared state', () => {
    const session = getDemoSessions().find((candidate) => candidate.id === 's2');
    if (!session) throw new Error('Expected seeded session s2');
    const initialEnrolled = session.enrolled;

    setDemoSessionRegistration('s2', 'p8', 'competitor');
    expect(getDemoSessionRegistrations('p8')).toContainEqual({
      session_id: 's2',
      registration_type: 'competitor',
    });
    expect(session.enrolled).toBe(initialEnrolled + 1);

    setDemoSessionRegistration('s2', 'p8', null);
    expect(session.enrolled).toBe(initialEnrolled);
  });
});
