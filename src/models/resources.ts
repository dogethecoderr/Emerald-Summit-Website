// Resources hub (spec §04): the master schedule plus a document library —
// maps, codes of conduct, track briefs, sponsor info, slide decks — searchable,
// optionally attached to a discipline so they surface in context.

export type ResourceCategory =
  | 'Maps'
  | 'Guides'
  | 'Track Briefs'
  | 'Sponsors'
  | 'Slides'
  | 'Forms';

export type ResourceType = 'PDF' | 'Link' | 'Video' | 'Form' | 'Deck';

export interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type: ResourceType;
  size?: string;
  /** Discipline `name` key when the resource is track-specific. */
  discipline?: string;
  updated: string;
}

export const MOCK_RESOURCES: Resource[] = [
  {
    id: 'r1',
    title: 'Emerald High Campus Map',
    description: 'Full campus map with room letters, parking, and check-in desk.',
    category: 'Maps',
    type: 'PDF',
    size: '950 KB',
    updated: 'Jun 30',
  },
  {
    id: 'r2',
    title: 'Master Schedule — All Tracks',
    description: 'Every session, room, and time block across all six disciplines.',
    category: 'Guides',
    type: 'PDF',
    size: '1.2 MB',
    updated: 'Jun 30',
  },
  {
    id: 'r3',
    title: 'Code of Conduct & Community Agreement',
    description: 'Expectations for all attendees, signed at check-in.',
    category: 'Forms',
    type: 'PDF',
    size: '420 KB',
    updated: 'Jun 27',
  },
  {
    id: 'r4',
    title: 'TechVerse Track Brief',
    description: 'Judging rubric overview, equipment list, and lab rules.',
    category: 'Track Briefs',
    type: 'PDF',
    size: '610 KB',
    discipline: 'techverse',
    updated: 'Jun 26',
  },
  {
    id: 'r5',
    title: 'BioSphere Track Brief',
    description: 'Research-poster format, wet-lab safety, and field-data guidance.',
    category: 'Track Briefs',
    type: 'PDF',
    size: '580 KB',
    discipline: 'biosphere',
    updated: 'Jun 26',
  },
  {
    id: 'r6',
    title: 'VentureVerse Pitch Template',
    description: '10-slide template every startup team pitches from.',
    category: 'Slides',
    type: 'Deck',
    size: '2.4 MB',
    discipline: 'ventureverse',
    updated: 'Jun 25',
  },
  {
    id: 'r7',
    title: 'Sponsor Prospectus 2027',
    description: 'Sponsorship tiers and community partners supporting the Summit.',
    category: 'Sponsors',
    type: 'PDF',
    size: '3.1 MB',
    updated: 'Jun 24',
  },
  {
    id: 'r8',
    title: 'Summit Promo Video',
    description: "Last year's highlight reel — share with friends and family.",
    category: 'Guides',
    type: 'Video',
    updated: 'Jun 24',
  },
  {
    id: 'r9',
    title: 'Volunteer Hours Log Template',
    description: 'For ambassadors logging service hours outside the app.',
    category: 'Forms',
    type: 'Form',
    updated: 'Jun 22',
  },
  {
    id: 'r10',
    title: 'ImagineX Studio Equipment Guide',
    description: 'Cameras, mics, and editing bays available in the Media Lab.',
    category: 'Track Briefs',
    type: 'PDF',
    size: '740 KB',
    discipline: 'imaginex',
    updated: 'Jun 21',
  },
];
