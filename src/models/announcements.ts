// Ported from the Annual Summit App prototype's Announcement type
// (src/app/App.tsx), expanded with `attachments` to absorb what the
// prototype's separate ResourcesScreen did (see ResourcesScreen ~line 699
// and its Resource type / RESOURCE_ICON map) — Resources isn't a standalone
// section in this app; a downloadable/linkable item now just rides along
// on the announcement that introduced it.

export type AnnouncementCategory = 'Logistics' | 'General' | 'Urgent' | 'Workshop';

export type AttachmentType = 'PDF' | 'Link' | 'Video' | 'Form';

export interface AnnouncementAttachment {
  title: string;
  type: AttachmentType;
  size?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  date: string;
  pinned: boolean;
  author: string;
  audience: string;
  attachments?: AnnouncementAttachment[];
}

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'Summit Date TBD — Stay Tuned!',
    body: 'We are finalizing the Summit date and will announce it as soon as it is confirmed. Please check back here for the official date and begin exploring the six discipline tracks.',
    category: 'General',
    date: 'Jun 29',
    pinned: true,
    author: 'Marcus Chen & Elena Rodriguez',
    audience: 'Everyone',
  },
  {
    id: 'a2',
    title: 'Discipline Track Sign-Ups Opening Soon',
    body: 'Registration for TechVerse, BioSphere, ImagineX, NovaSphere, VentureVerse, and CivicVerse opens once the Summit date is confirmed. Each track has limited spots — mark your interest now in the Schedule Builder.',
    category: 'General',
    date: 'Jun 29',
    pinned: true,
    author: 'Elena Rodriguez',
    audience: 'Participants',
  },
  {
    id: 'a3',
    title: 'Ambassador Applications Now Open',
    body: 'Emerald High students interested in representing a discipline as a Student Ambassador can apply below. Applications close two weeks before the Summit.',
    category: 'Urgent',
    date: 'Jun 28',
    pinned: false,
    author: 'Marcus Chen',
    audience: 'Ambassadors',
    attachments: [
      { title: 'Student Ambassador Application', type: 'Form' },
    ],
  },
  {
    id: 'a4',
    title: 'Volunteer Orientation Details Coming',
    body: 'A dedicated volunteer orientation will be held on the morning of the Summit. Details including time and location will be posted here once the date is set.',
    category: 'Logistics',
    date: 'Jun 27',
    pinned: false,
    author: 'Summit Ops Team',
    audience: 'Volunteers',
    attachments: [
      { title: 'Code of Conduct & Community Agreement', type: 'PDF', size: '420 KB' },
      { title: 'Emerald High Campus Map', type: 'PDF', size: '950 KB' },
    ],
  },
  {
    id: 'a5',
    title: 'TechVerse: Bring a Laptop',
    body: 'All TechVerse participants should bring a laptop or tablet. We will have a limited number of loaners available on a first-come basis at the front desk.',
    category: 'Workshop',
    date: 'Jun 26',
    pinned: false,
    author: 'Aiden Tran',
    audience: 'TechVerse',
  },
  {
    id: 'a6',
    title: 'Summit Promo Video Is Live',
    body: "Get a preview of last year's Summit — share it with friends and family who are curious what the day looks like.",
    category: 'General',
    date: 'Jun 24',
    pinned: false,
    author: 'Summit Ops Team',
    audience: 'Everyone',
    attachments: [{ title: 'Summit Promo Video', type: 'Video' }],
  },
];
