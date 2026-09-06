// Ported from the Annual Summit App prototype's Session type + SESSIONS data
// (src/app/App.tsx). `duration`, `description`, `room`, `spectatorCap`, and
// `spectators` are only needed by the Schedule builder — Featured Sessions
// (the Dashboard preview) only reads the rest.

export interface Session {
  id: string;
  title: string;
  speaker: string;
  time: string;
  location: string;
  /** A UserDiscipline `name` key, or 'keynote' for the emerald keynote pill. */
  track: string;
  duration: string;
  description: string;
  capacity: number;
  enrolled: number;
  spectatorCap: number;
  spectators: number;
  /** Letter used to look up walking time between rooms; see WALKING_TIME. */
  room: string;
}

export const TIME_SLOTS = [
  '9:00 AM',
  '11:00 AM',
  '1:00 PM',
  '2:30 PM',
  '3:45 PM',
  '5:00 PM',
];

/**
 * Placeholder volunteer assignments for the schedule prototype. These
 * intentionally vary per event while the real volunteer sign-up data is
 * connected; every event can have at most ten volunteers.
 */
export const VOLUNTEER_CAPACITY = 10;

export const MOCK_VOLUNTEER_COUNTS: Record<string, number> = {
  s1: 8,
  s2: 5,
  s3: 3,
  s4: 10,
  s5: 7,
  s6: 4,
  s7: 9,
  s8: 2,
  s9: 6,
  s10: 10,
  s11: 1,
  s12: 8,
  s13: 5,
};

/** Minutes to walk between rooms; only pairs worth warning about are listed. */
export const WALKING_TIME: Record<string, Record<string, number>> = {
  A: { B: 3, C: 5, D: 4, E: 6, F: 7, G: 5, H: 8, I: 6, J: 4 },
  B: { A: 3, C: 4, D: 3, E: 5, F: 6, G: 4, H: 7, I: 5, J: 3 },
  C: { A: 5, B: 4, D: 2, E: 3, F: 8, G: 3, H: 9, I: 4, J: 6 },
};

export const MOCK_SESSIONS: Session[] = [
  {
    id: 's1',
    title: 'Opening Keynote: Innovate, Imagine, Impact',
    speaker: 'Marcus Chen & Elena Rodriguez',
    time: '9:00 AM',
    location: 'Main Hall A',
    room: 'A',
    track: 'keynote',
    duration: '60 min',
    description:
      'Summit directors open the day with a vision for what students can build, discover, and lead.',
    capacity: 300,
    enrolled: 212,
    spectatorCap: 0,
    spectators: 0,
  },
  {
    id: 's2',
    title: 'AI & Machine Learning Foundations',
    speaker: 'TechVerse Faculty Lead',
    time: '11:00 AM',
    location: 'Computer Lab',
    room: 'C',
    track: 'techverse',
    duration: '75 min',
    description:
      'Hands-on intro to ML concepts with live demos and beginner coding exercises.',
    capacity: 30,
    enrolled: 28,
    spectatorCap: 10,
    spectators: 4,
  },
  {
    id: 's3',
    title: 'Climate Solutions by Students',
    speaker: 'BioSphere Panel',
    time: '11:00 AM',
    location: 'Room 204',
    room: 'D',
    track: 'biosphere',
    duration: '60 min',
    description:
      'Student researchers present local environmental projects and scalable solutions.',
    capacity: 40,
    enrolled: 31,
    spectatorCap: 15,
    spectators: 7,
  },
  {
    id: 's4',
    title: 'Visual Storytelling & Brand Design',
    speaker: 'ImagineX Studio Lead',
    time: '11:00 AM',
    location: 'Design Studio',
    room: 'E',
    track: 'imaginex',
    duration: '90 min',
    description:
      'Workshop on visual identity, layout, and communicating ideas through design.',
    capacity: 24,
    enrolled: 24,
    spectatorCap: 8,
    spectators: 2,
  },
  {
    id: 's5',
    title: 'Rocket Science & Space Exploration',
    speaker: 'NovaSphere Volunteers',
    time: '1:00 PM',
    location: 'Science Wing',
    room: 'F',
    track: 'novasphere',
    duration: '60 min',
    description:
      'From orbital mechanics to student-built model rockets — exploring beyond Earth.',
    capacity: 30,
    enrolled: 18,
    spectatorCap: 12,
    spectators: 3,
  },
  {
    id: 's6',
    title: 'Pitch Your Idea: Startup Studio',
    speaker: 'VentureVerse Coaches',
    time: '1:00 PM',
    location: 'Innovation Hub',
    room: 'G',
    track: 'ventureverse',
    duration: '90 min',
    description:
      'Students pitch business concepts to a panel of volunteers and receive live feedback.',
    capacity: 20,
    enrolled: 17,
    spectatorCap: 20,
    spectators: 11,
  },
  {
    id: 's7',
    title: 'Mock Legislature & Policy Debate',
    speaker: 'CivicVerse Facilitators',
    time: '1:00 PM',
    location: 'Room 108',
    room: 'B',
    track: 'civicverse',
    duration: '75 min',
    description: 'Simulate the legislative process by debating real policy proposals.',
    capacity: 35,
    enrolled: 22,
    spectatorCap: 15,
    spectators: 6,
  },
  {
    id: 's8',
    title: 'Cybersecurity & Ethical Hacking',
    speaker: 'TechVerse Faculty Lead',
    time: '2:30 PM',
    location: 'Computer Lab',
    room: 'C',
    track: 'techverse',
    duration: '60 min',
    description:
      'Explore how vulnerabilities are found and patched — and the ethics behind disclosure.',
    capacity: 30,
    enrolled: 26,
    spectatorCap: 8,
    spectators: 8,
  },
  {
    id: 's9',
    title: 'Genetics, CRISPR & Bioethics',
    speaker: 'BioSphere Faculty Lead',
    time: '2:30 PM',
    location: 'Bio Lab',
    room: 'H',
    track: 'biosphere',
    duration: '60 min',
    description:
      'Dive into gene editing technology and the moral questions scientists must navigate.',
    capacity: 28,
    enrolled: 15,
    spectatorCap: 10,
    spectators: 2,
  },
  {
    id: 's10',
    title: 'Film & Podcast Production Lab',
    speaker: 'ImagineX Media Team',
    time: '2:30 PM',
    location: 'Media Lab',
    room: 'I',
    track: 'imaginex',
    duration: '60 min',
    description:
      'Record, edit, and produce a short segment using professional studio equipment.',
    capacity: 20,
    enrolled: 20,
    spectatorCap: 5,
    spectators: 5,
  },
  {
    id: 's11',
    title: 'Financial Literacy & Investing 101',
    speaker: 'VentureVerse Coaches',
    time: '3:45 PM',
    location: 'Innovation Hub',
    room: 'G',
    track: 'ventureverse',
    duration: '60 min',
    description:
      'Stocks, compound interest, and personal finance — tools every student should know.',
    capacity: 35,
    enrolled: 19,
    spectatorCap: 20,
    spectators: 4,
  },
  {
    id: 's12',
    title: 'Community Leadership & Civic Action',
    speaker: 'CivicVerse Panel',
    time: '3:45 PM',
    location: 'Courtyard Stage',
    room: 'J',
    track: 'civicverse',
    duration: '60 min',
    description:
      'Local student leaders discuss how to organize and create change in Dublin.',
    capacity: 60,
    enrolled: 34,
    spectatorCap: 40,
    spectators: 12,
  },
  {
    id: 's13',
    title: 'Closing Ceremony & Discipline Awards',
    speaker: 'Marcus Chen & Elena Rodriguez',
    time: '5:00 PM',
    location: 'Main Hall A',
    room: 'A',
    track: 'keynote',
    duration: '45 min',
    description:
      'Celebrate standout work across all six disciplines with peer-nominated awards.',
    capacity: 300,
    enrolled: 198,
    spectatorCap: 0,
    spectators: 0,
  },
];
