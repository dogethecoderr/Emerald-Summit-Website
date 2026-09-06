/**
 * The volunteer view of the Summit program. These entries mirror the
 * color-coded track grid used by on-site volunteers, rather than the broader
 * participant session catalog.
 */
export type VolunteerTrackId =
  | 'techverse'
  | 'biosphere'
  | 'imaginex'
  | 'novasphere'
  | 'ventureverse';

export type VolunteerShift = 'morning' | 'afternoon';

export interface VolunteerScheduleItem {
  time: string;
  title: string;
  location: string;
  assignment: string;
}

export interface VolunteerTrackSchedule {
  id: VolunteerTrackId;
  label: string;
  tagline: string;
  /** Track color copied from the volunteer schedule reference. */
  color: string;
  schedule: VolunteerScheduleItem[];
}

export const VOLUNTEER_TRACKS: VolunteerTrackSchedule[] = [
  {
    id: 'techverse',
    label: 'TechVerse',
    tagline: 'Build, code, and create',
    color: '#F6D56D',
    schedule: [
      { time: '9:30–11:30', title: 'Robotthon', location: 'E-203', assignment: 'TWR' },
      { time: '9:30–11:30', title: 'Presentations', location: 'E-205 & E-206', assignment: 'TPC / TPE' },
      { time: '9:30–11:30', title: 'App & CS Showcase', location: 'E-207', assignment: 'TEC' },
      { time: '9:30–11:30', title: 'Engineering Showcase', location: 'E-2F open area', assignment: 'TEE' },
      { time: '12:00–1:30', title: 'CAD-athon', location: 'E-203', assignment: 'TWC' },
      { time: '12:00–1:30', title: 'Product Design Workshop', location: 'E-205 & E-206', assignment: 'TWP' },
    ],
  },
  {
    id: 'biosphere',
    label: 'BioSphere',
    tagline: 'Explore life and health sciences',
    color: '#D0E2E7',
    schedule: [
      { time: '9:30–10:45', title: 'Psychology Exhibit', location: 'F-215', assignment: 'BEP' },
      { time: '9:30–11:00', title: 'Genetics + Other Presentations', location: 'F-214', assignment: 'BPG / BPO' },
      { time: '9:30–11:00', title: 'Neuroscience Presentation #1', location: 'F-207', assignment: 'BPN' },
      { time: '9:30–11:00', title: 'Neuroscience Presentation #2', location: 'F-208', assignment: 'BPN' },
      { time: '11:00–1:30', title: 'Emergency Medicine', location: 'F-225 & F-226', assignment: 'BWE' },
    ],
  },
  {
    id: 'imaginex',
    label: 'ImagineX',
    tagline: 'Ideas, design, and innovation',
    color: '#F5DEC5',
    schedule: [
      { time: '9:30–10:30', title: 'Presentations', location: 'F-235', assignment: 'IP' },
      { time: '10:30–1:30', title: 'Exhibits', location: 'F-235', assignment: 'IE' },
    ],
  },
  {
    id: 'novasphere',
    label: 'NovaSphere',
    tagline: 'Discover space and physics',
    color: '#C9DCEE',
    schedule: [
      { time: '9:30–11:00', title: 'Presentation', location: 'F-118', assignment: 'NP' },
      { time: '9:30–1:30', title: 'Virtual Stock Market', location: 'F-108', assignment: 'VWS' },
      { time: '11:30–1:00', title: 'Exhibits', location: 'F-118', assignment: 'NE' },
    ],
  },
  {
    id: 'ventureverse',
    label: 'VentureVerse',
    tagline: 'Pitch, connect, and lead',
    color: '#D8E8D1',
    schedule: [
      { time: '9:30–10:30', title: 'Shark Tank · Session 1', location: 'Lecture Hall', assignment: 'VWE' },
      { time: '11:00–11:30', title: 'Fireside Chat', location: 'Lecture Hall', assignment: 'VWE' },
      { time: '12:30–1:30', title: 'Shark Tank · Session 2', location: 'Lecture Hall', assignment: 'VWE' },
    ],
  },
];

export function volunteerTrackById(
  id: string | null | undefined,
): VolunteerTrackSchedule | undefined {
  return VOLUNTEER_TRACKS.find((track) => track.id === id);
}
