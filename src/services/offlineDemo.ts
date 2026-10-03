import { MOCK_PEOPLE, type Person } from '../models/people';
import { USER_DISCIPLINES } from '../models/disciplines';
import { MOCK_SESSIONS, type Session } from '../models/sessions';

export interface DemoTrack {
  name: string;
  label: string;
  color: string;
  is_discipline: boolean;
  description?: string;
}

export interface DemoNotification {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

const demoPeople: Person[] = MOCK_PEOPLE.map((person) => ({
  ...person,
  registeredDisciplines: person.registeredDisciplines
    ? [...person.registeredDisciplines]
    : undefined,
}));
demoPeople.push(
  {
    id: 'p12',
    name: 'Samira Patel',
    role: 'participant',
    org: 'Emerald High School',
    email: 's.patel@emeraldhigh.edu',
    phone: '',
    initials: 'SP',
    bio: 'Registered for multiple disciplines and helps the welcome desk.',
    discipline: 'techverse',
    registeredDisciplines: ['techverse', 'civicverse'],
    is_volunteer: true,
    is_front_desk: false,
    emailVisible: 'private',
    phoneVisible: 'private',
    status: 'validated',
  },
  {
    id: 'p13',
    name: 'Noah Williams',
    role: 'participant',
    org: 'Dublin High School',
    email: 'n.williams@example.edu',
    phone: '',
    initials: 'NW',
    bio: 'BioSphere participant.',
    discipline: 'biosphere',
    registeredDisciplines: ['biosphere'],
    emailVisible: 'private',
    phoneVisible: 'private',
    status: 'validated',
  },
  {
    id: 'p14',
    name: 'Taylor Morgan',
    role: 'expert',
    org: 'Summit Expert',
    email: 't.morgan@example.org',
    phone: '',
    initials: 'TM',
    bio: 'Volunteer expert judging student sessions.',
    discipline: 'techverse',
    emailVisible: 'private',
    phoneVisible: 'private',
    status: 'validated',
  },
);

const frontDeskDemo = demoPeople.find((person) => person.id === 'p10');
if (frontDeskDemo) {
  frontDeskDemo.discipline = 'novasphere';
  frontDeskDemo.is_volunteer = true;
  frontDeskDemo.is_front_desk = true;
}
const trackVolunteerDemo = demoPeople.find((person) => person.id === 'p11');
if (trackVolunteerDemo) {
  trackVolunteerDemo.discipline = 'biosphere';
  trackVolunteerDemo.is_volunteer = true;
  trackVolunteerDemo.is_front_desk = false;
}

let demoTracks: DemoTrack[] = [
  ...USER_DISCIPLINES.map((track) => ({ ...track, is_discipline: true })),
  { name: 'keynote', label: 'Keynote', color: '#0C7A55', is_discipline: false },
];
let demoSessions: Session[] = MOCK_SESSIONS.map((session) => ({ ...session }));
let demoNotifications: DemoNotification[] = [];
const demoSessionRegistrations = new Map<string, Map<string, 'competitor' | 'expert' | 'spectator'>>();
demoSessionRegistrations.set('s2', new Map([
  ['p12', 'competitor'],
  ['p13', 'spectator'],
  ['p14', 'expert'],
]));
demoSessionRegistrations.set('s5', new Map([
  ['p7', 'competitor'],
  ['p12', 'competitor'],
]));
const listeners = new Set<() => void>();

function notifyChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeOfflineDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDemoPeople(): Person[] {
  return demoPeople;
}

export function getDemoTracks(): DemoTrack[] {
  return demoTracks;
}

export function getDemoSessions(): Session[] {
  return demoSessions;
}

export function getDemoNotifications(userId: string): DemoNotification[] {
  return demoNotifications
    .filter((notification) => notification.recipient_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getActiveDemoUserId(): string | null {
  try {
    const rawProfile = localStorage.getItem('bypass_profile');
    if (!rawProfile) return null;
    const profile = JSON.parse(rawProfile) as { id?: string };
    return profile.id ?? null;
  } catch {
    return null;
  }
}

export function switchActiveDemoUser(userId: string): void {
  const person = demoPeople.find((candidate) => candidate.id === userId);
  if (!person) throw new Error('Demo user not found.');
  const profile = {
    id: person.id,
    email: person.email,
    name: person.name,
    role: person.role,
    discipline: person.discipline ?? null,
    is_volunteer: person.is_volunteer ?? person.role === 'volunteer',
    is_front_desk: person.is_front_desk ?? false,
    checked_in_at: person.checked_in_at ?? null,
    profile_setup_complete: true,
  };
  localStorage.setItem('bypass_profile', JSON.stringify(profile));
  window.dispatchEvent(new Event('storage'));
}

export function addDemoTrack(track: DemoTrack): void {
  demoTracks = [...demoTracks.filter((existing) => existing.name !== track.name), { ...track }];
  notifyChange();
}

export function removeDemoTrack(name: string): void {
  const track = demoTracks.find((item) => item.name === name);
  if (!track) throw new Error('Track not found.');
  if (name === 'keynote') throw new Error('The keynote track cannot be removed.');

  const affectedIds = new Set<string>();
  demoPeople.forEach((person) => {
    const disciplines = person.registeredDisciplines ?? [];
    if (person.discipline === name || disciplines.includes(name)) {
      affectedIds.add(person.id);
    }
    if (person.discipline === name) person.discipline = null;
    person.registeredDisciplines = disciplines.filter((discipline) => discipline !== name);
  });

  const removedSessions = demoSessions.filter((session) => session.track === name);
  removedSessions.forEach((session) => {
    demoSessionRegistrations.get(session.id)?.forEach((_type, userId) => affectedIds.add(userId));
    demoSessionRegistrations.delete(session.id);
  });
  demoSessions = demoSessions.filter((session) => session.track !== name);
  demoTracks = demoTracks.filter((item) => item.name !== name);

  const createdAt = new Date().toISOString();
  affectedIds.forEach((recipientId) => {
    demoNotifications.unshift({
      id: `notification-${Date.now()}-${recipientId}`,
      recipient_id: recipientId,
      title: `Track update: ${track.label}`,
      body: `${track.label} has been removed. Your track registration and related session reservations have been canceled.`,
      created_at: createdAt,
      read_at: null,
    });
  });
  notifyChange();
}

export function addDemoNotification(notification: Omit<DemoNotification, 'id' | 'created_at' | 'read_at'>): void {
  demoNotifications.unshift({
    ...notification,
    id: `notification-${Date.now()}-${notification.recipient_id}`,
    created_at: new Date().toISOString(),
    read_at: null,
  });
  notifyChange();
}

export function markDemoNotificationRead(notificationId: string, userId: string): void {
  const notification = demoNotifications.find((item) =>
    item.id === notificationId && item.recipient_id === userId,
  );
  if (!notification) throw new Error('Notification not found.');
  notification.read_at = new Date().toISOString();
  notifyChange();
}

export function checkInDemoPerson(
  personId: string,
  actorId: string | null,
): { person: Person; alreadyCheckedIn: boolean } {
  const person = demoPeople.find((candidate) => candidate.id === personId);
  if (!person) throw new Error('Participant not found.');
  assertCanManageDemoCheckIn(person, actorId);

  const alreadyCheckedIn = person.status === 'checkedIn' || Boolean(person.checked_in_at);
  if (!alreadyCheckedIn) {
    person.status = 'checkedIn';
    person.checked_in_at = new Date().toISOString();
    notifyChange();
  }
  return { person, alreadyCheckedIn };
}

export function undoDemoCheckIn(personId: string, actorId: string | null): void {
  const person = demoPeople.find((candidate) => candidate.id === personId);
  if (!person) throw new Error('Participant not found.');
  assertCanManageDemoCheckIn(person, actorId);
  person.status = 'validated';
  person.checked_in_at = null;
  notifyChange();
}

function assertCanManageDemoCheckIn(person: Person, actorId: string | null): void {
  if (actorId === person.id) return;
  const actor = demoPeople.find((candidate) => candidate.id === actorId);
  if (!actor || !(actor.role === 'volunteer' || actor.is_volunteer)) {
    throw new Error('Select a volunteer demo account to check in other participants.');
  }
  if (actor.is_front_desk) return;
  const registeredDisciplines = person.registeredDisciplines ?? [];
  if (
    person.role !== 'participant' ||
    !actor.discipline ||
    (person.discipline !== actor.discipline && !registeredDisciplines.includes(actor.discipline))
  ) {
    throw new Error('This person is not in your discipline.');
  }
}

export function addDemoSession(session: Session, existingId?: string): void {
  const existing = existingId
    ? demoSessions.find((candidate) => candidate.id === existingId)
    : undefined;
  const next = {
    ...session,
    id: existingId ?? session.id,
    enrolled: existing?.enrolled ?? session.enrolled,
    expertsEnrolled: existing?.expertsEnrolled ?? session.expertsEnrolled,
    spectators: existing?.spectators ?? session.spectators,
  };
  demoSessions = existingId
    ? demoSessions.map((candidate) => candidate.id === existingId ? next : candidate)
    : [...demoSessions, next];
  notifyChange();
}

export function removeDemoSession(sessionId: string): void {
  demoSessions = demoSessions.filter((session) => session.id !== sessionId);
  demoSessionRegistrations.delete(sessionId);
  notifyChange();
}

export function getDemoSessionRegistrations(userId: string): Array<{
  session_id: string;
  registration_type: 'competitor' | 'expert' | 'spectator';
}> {
  const registrations: Array<{
    session_id: string;
    registration_type: 'competitor' | 'expert' | 'spectator';
  }> = [];
  demoSessionRegistrations.forEach((users, sessionId) => {
    const registrationType = users.get(userId);
    if (registrationType) registrations.push({ session_id: sessionId, registration_type: registrationType });
  });
  return registrations;
}

export function setDemoSessionRegistration(
  sessionId: string,
  userId: string,
  registrationType: 'competitor' | 'expert' | 'spectator' | null,
): void {
  const session = demoSessions.find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error('Session not found.');
  let registrations = demoSessionRegistrations.get(sessionId);
  if (!registrations) {
    registrations = new Map();
    demoSessionRegistrations.set(sessionId, registrations);
  }
  const previous = registrations.get(userId);
  if (previous === registrationType) return;

  if (
    registrationType === 'competitor' &&
    previous !== 'competitor' &&
    session.enrolled >= session.capacity
  ) throw new Error('Session full');
  if (
    registrationType === 'expert' &&
    previous !== 'expert' &&
    session.expertsEnrolled >= session.expertCapacity
  ) throw new Error('Expert spots full');
  if (
    registrationType === 'spectator' &&
    previous !== 'spectator' &&
    session.spectators >= session.spectatorCap
  ) throw new Error('Spectator seats full');

  if (previous === 'competitor') session.enrolled = Math.max(0, session.enrolled - 1);
  if (previous === 'expert') session.expertsEnrolled = Math.max(0, session.expertsEnrolled - 1);
  if (previous === 'spectator') session.spectators = Math.max(0, session.spectators - 1);
  if (registrationType === 'competitor') {
    session.enrolled += 1;
  }
  if (registrationType === 'expert') {
    session.expertsEnrolled += 1;
  }
  if (registrationType === 'spectator') {
    session.spectators += 1;
  }
  if (registrationType) registrations.set(userId, registrationType);
  else registrations.delete(userId);
  notifyChange();
}

export function updateDemoUser(
  userId: string,
  updates: Partial<Pick<Person, 'is_volunteer' | 'is_front_desk' | 'discipline'>>,
): void {
  const person = demoPeople.find((candidate) => candidate.id === userId);
  if (!person) throw new Error('Mock user not found.');
  Object.assign(person, updates);
  if (updates.is_front_desk) person.is_volunteer = true;
  if (updates.is_volunteer === false) person.is_front_desk = false;
  notifyChange();
}

export function saveDemoProfile(profile: {
  id: string;
  email: string;
  role?: string;
  name: string;
  phone?: string;
  discipline?: string | null;
  disciplines?: string[];
  bio?: string;
  is_volunteer?: boolean;
  is_front_desk?: boolean;
}): void {
  let person = demoPeople.find((candidate) => candidate.id === profile.id);
  if (!person) {
    const initials = profile.name
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
    person = {
      id: profile.id,
      name: profile.name,
      role: profile.role ?? 'participant',
      org: 'Emerald High School',
      email: profile.email,
      phone: profile.phone ?? '',
      initials,
      bio: profile.bio ?? '',
      discipline: profile.discipline ?? null,
      registeredDisciplines: profile.disciplines ?? [],
      is_volunteer: profile.is_volunteer,
      is_front_desk: profile.is_front_desk,
      emailVisible: 'private',
      phoneVisible: 'private',
      status: 'validated',
    };
    demoPeople.push(person);
  } else {
    person.name = profile.name;
    person.email = profile.email;
    person.phone = profile.phone ?? person.phone;
    person.bio = profile.bio ?? person.bio;
    if (profile.discipline !== undefined) person.discipline = profile.discipline;
    if (profile.disciplines) person.registeredDisciplines = [...profile.disciplines];
  }
  notifyChange();
}
