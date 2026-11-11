import { describe, expect, test } from 'vitest';
import {
  addModesForRole,
  conflictMessage,
  myProjectFromRow,
  mustHandOff,
  normalizeTeamCode,
  parseQuestions,
  participationClosed,
  registrationResultFrom,
  teamCodePrefix,
  teamLookupFrom,
  teamLookupProblem,
} from '../registration';
import { missingGateField, formFields } from '../profileFields';
import { canonicalSchoolName } from '../schools';
import { countBy, crossTab, gradeLabel } from '../metrics';
import { safeAttachmentUrl } from '../../services/announcements';

describe('registration rules ported from the app', () => {
  test('register_for_session outcomes map like RegistrationResult', () => {
    expect(registrationResultFrom({ outcome: 'added', team_code: 'TV1234' })).toEqual({ outcome: 'added', teamCode: 'TV1234' });
    expect(registrationResultFrom({ outcome: 'conflict', conflicting_title: 'Robots', conflict_kind: 'managing' }))
      .toEqual({ outcome: 'conflict', conflictingTitle: 'Robots', conflictKind: 'managing' });
    expect(registrationResultFrom({ outcome: 'choose_new_owner' })).toEqual({
      outcome: 'invalid_project',
      message: 'You own this team. Choose a teammate to take over before you leave.',
    });
    expect(registrationResultFrom({ outcome: 'participation_closed' }).outcome).toBe('participation_closed');
  });

  test('conflict wording follows the role, like the app', () => {
    expect(conflictMessage('managing', 'Robots', 'admin')).toContain('Stop managing that one first');
    expect(conflictMessage('managing', 'Robots', 'volunteer')).toContain('Ask an admin to take you off');
    expect(conflictMessage('managing_this', null, 'participant')).toBe("You're managing this session, so you can't also sign up for it.");
  });

  test('each role gets the app\'s add choices', () => {
    expect(addModesForRole('participant')).toEqual(['participate', 'spectate']);
    expect(addModesForRole('volunteer')).toEqual(['participate', 'spectate']);
    expect(addModesForRole('expert')).toEqual(['expert', 'spectate']);
    expect(addModesForRole('admin')).toEqual(['participate', 'spectate', 'manage']);
    expect(addModesForRole('attendee')).toEqual(['spectate']);
  });

  test('team codes and lookups', () => {
    expect(normalizeTeamCode(' tv 48 21 ')).toBe('TV4821');
    expect(teamCodePrefix('techverse', 'TechVerse')).toBe('TV');
    expect(teamCodePrefix('newone', 'Art Lab')).toBe('AL');
    expect(teamLookupProblem(teamLookupFrom({ outcome: 'full', project_name: 'Rover', member_count: 4, max_team_size: 4 })))
      .toBe('"Rover" is full (4 of 4 members).');
    expect(teamLookupProblem(teamLookupFrom({ outcome: 'found' }))).toBeNull();
  });

  test('an owner with teammates must hand the team over before leaving', () => {
    const project = myProjectFromRow({
      mode: 'team', project_name: 'Rover', team_code: 'TV1', is_owner: true, max_team_size: 4,
      member_details: [{ id: 'a', name: 'A', is_owner: true }, { id: 'b', name: 'B', is_owner: false }],
    });
    expect(mustHandOff(project)).toBe(true);
    expect(mustHandOff({ ...project!, members: project!.members.slice(0, 1) })).toBe(false);
    expect(myProjectFromRow({ mode: null })).toBeNull();
  });

  test('questions and the participant deadline parse safely', () => {
    expect(parseQuestions('[{"id":"q1","prompt":"Why?"},{"id":"","prompt":"x"}]')).toEqual([{ id: 'q1', prompt: 'Why?' }]);
    expect(parseQuestions('not json')).toEqual([]);
    expect(participationClosed('2000-01-01T00:00:00Z')).toBe(true);
    expect(participationClosed(null)).toBe(false);
  });
});

describe('profile fields ported from the app', () => {
  test('participants need school and grade; volunteers need a phone', () => {
    expect(formFields('participant', null).filter((f) => f.required).map((f) => f.key)).toEqual(['school', 'grade']);
    expect(formFields('volunteer', 'parent_volunteer').map((f) => f.key)).toEqual(['phone', 'student_id']);
    expect(formFields('volunteer', 'student_volunteer').map((f) => f.key)).toEqual(['phone', 'student_id', 'grade']);
  });

  test('the sign-in gate asks for a missing phone, then a missing grade', () => {
    const base = { profile_setup_complete: true, role: 'volunteer', volunteer_subtype: 'eaf_ambassador' };
    expect(missingGateField({ ...base, details: {} })).toBe('phone');
    expect(missingGateField({ ...base, details: { phone: '555' } })).toBe('grade');
    expect(missingGateField({ ...base, details: { phone: '555', grade: '11' } })).toBeNull();
    expect(missingGateField({ ...base, role: 'participant', details: {} })).toBeNull();
  });
});

describe('metrics helpers ported from the app', () => {
  test('schools and grades are counted under one name', () => {
    expect(canonicalSchoolName('dvhs')).toBe('Dougherty Valley High School');
    expect(canonicalSchoolName('  ohlone college ')).toBe('Ohlone College');
    expect(gradeLabel('Junior')).toBe('11');
    expect(gradeLabel('')).toBe('No grade given');
    expect(countBy([['A', '1'], ['A', '1'], ['B', '2']])).toEqual([['A', 1], ['B', 1]]);
    const t = crossTab([['Dublin', 'Tech', '1'], ['Dublin', 'Tech', '1'], ['Dublin', 'Bio', '1']], ['Bio', 'Tech']);
    expect(t.rowTotals.get('Dublin')).toBe(1);
    expect(t.count('Dublin', 'Tech')).toBe(1);
  });
});

describe('attachment links', () => {
  test('only https links open, never javascript:', () => {
    expect(safeAttachmentUrl('javascript:alert(1)', 'Link')).toBeUndefined();
    expect(safeAttachmentUrl('http://example.com/a', 'Link')).toBeUndefined();
    expect(safeAttachmentUrl('https://forms.example.com/a', 'Link')).toBe('https://forms.example.com/a');
  });
});
