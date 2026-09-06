// Ported from the Annual Summit App prototype's Person type + PEOPLE data
// (src/app/App.tsx). `checkedIn: boolean` is replaced with the shared
// PersonStatus enum (see src/models/personStatus.ts) so the directory shows
// "Validated"/"Checked In" instead of a bare checkmark.

import type { PersonStatus } from './personStatus';

export type Visibility = 'public' | 'ambassadors' | 'private';

export interface Person {
  id: string;
  name: string;
  /** A UserRole `name` key. */
  role: string;
  org: string;
  email: string;
  phone: string;
  initials: string;
  bio: string;
  emailVisible: Visibility;
  phoneVisible: Visibility;
  /** When set, controls whether the bio line appears on directory cards. */
  bioVisible?: Visibility;
  status: PersonStatus;
}

export const MOCK_PEOPLE: Person[] = [
  {
    id: 'p1',
    name: 'Marcus Chen',
    role: 'admin',
    org: 'Emerald High School',
    email: 'm.chen@emeraldhigh.edu',
    phone: '(925) 555-0101',
    initials: 'BP',
    bio: 'Summit co-director and faculty advisor overseeing all six discipline tracks.',
    emailVisible: 'public',
    phoneVisible: 'public',
    status: 'checkedIn',
  },
  {
    id: 'p2',
    name: 'Elena Rodriguez',
    role: 'admin',
    org: 'Emerald High School',
    email: 'e.rodriguez@emeraldhigh.edu',
    phone: '(925) 555-0102',
    initials: 'DK',
    bio: 'Summit co-director leading participant experience, logistics, and volunteer engagement.',
    emailVisible: 'public',
    phoneVisible: 'public',
    status: 'checkedIn',
  },
  {
    id: 'p3',
    name: 'Aiden Tran',
    role: 'ambassador',
    org: 'Emerald High School',
    email: 'a.tran@emeraldhigh.edu',
    phone: '(925) 555-0103',
    initials: 'AT',
    bio: 'TechVerse ambassador and robotics team captain; running Summit tech support.',
    emailVisible: 'ambassadors',
    phoneVisible: 'ambassadors',
    status: 'checkedIn',
  },
  {
    id: 'p4',
    name: 'Meera Rao',
    role: 'ambassador',
    org: 'Emerald High School',
    email: 'm.rao@emeraldhigh.edu',
    phone: '(925) 555-0104',
    initials: 'MR',
    bio: 'BioSphere ambassador and founder of Emerald Environmental Action Club.',
    emailVisible: 'public',
    phoneVisible: 'private',
    status: 'validated',
  },
  {
    id: 'p5',
    name: 'Camille Osei',
    role: 'ambassador',
    org: 'Emerald High School',
    email: 'c.osei@emeraldhigh.edu',
    phone: '(925) 555-0105',
    initials: 'CO',
    bio: 'ImagineX ambassador, yearbook editor, and design lead for Summit branding.',
    emailVisible: 'ambassadors',
    phoneVisible: 'private',
    status: 'checkedIn',
  },
  {
    id: 'p6',
    name: 'Lucas Mendes',
    role: 'ambassador',
    org: 'Emerald High School',
    email: 'l.mendes@emeraldhigh.edu',
    phone: '(925) 555-0106',
    initials: 'LM',
    bio: "VentureVerse ambassador and winner of last year's Dublin Youth Pitch Competition.",
    emailVisible: 'public',
    phoneVisible: 'ambassadors',
    status: 'validated',
  },
  {
    id: 'p7',
    name: 'Priya Sharma',
    role: 'participant',
    org: 'Emerald High School',
    email: 'p.sharma@emeraldhigh.edu',
    phone: '(925) 555-0107',
    initials: 'PS',
    bio: 'Sophomore in NovaSphere — fascinated by astrophysics and computational math.',
    emailVisible: 'private',
    phoneVisible: 'private',
    status: 'checkedIn',
  },
  {
    id: 'p8',
    name: 'Jordan Wu',
    role: 'participant',
    org: 'Emerald High School',
    email: 'j.wu@emeraldhigh.edu',
    phone: '(925) 555-0108',
    initials: 'JW',
    bio: 'Junior enrolled in CivicVerse; active in Dublin City Youth Advisory Committee.',
    emailVisible: 'private',
    phoneVisible: 'private',
    status: 'validated',
  },
  {
    id: 'p9',
    name: 'Nadia El-Amin',
    role: 'participant',
    org: 'Emerald High School',
    email: 'n.elamin@emeraldhigh.edu',
    phone: '(925) 555-0109',
    initials: 'NE',
    bio: 'Senior in ImagineX with a focus on documentary filmmaking and digital journalism.',
    emailVisible: 'private',
    phoneVisible: 'private',
    status: 'checkedIn',
  },
  {
    id: 'p10',
    name: 'Ravi & Sunita Sharma',
    role: 'volunteer',
    org: 'Volunteer Council',
    email: 'sharmas@email.com',
    phone: '(925) 555-0110',
    initials: 'RS',
    bio: 'Volunteer council co-chairs coordinating student support and Summit communications.',
    emailVisible: 'ambassadors',
    phoneVisible: 'private',
    status: 'none',
  },
  {
    id: 'p11',
    name: 'Teresa Mendes',
    role: 'volunteer',
    org: 'Volunteer Council',
    email: 't.mendes@email.com',
    phone: '(925) 555-0111',
    initials: 'TM',
    bio: 'PTA treasurer and lead organizer for the Summit family luncheon.',
    emailVisible: 'ambassadors',
    phoneVisible: 'private',
    status: 'none',
  },
];
