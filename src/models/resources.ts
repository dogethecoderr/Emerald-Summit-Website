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
  /** Where the file lives; the card opens it in a new tab. */
  url?: string;
}

/**
 * The document library. Empty until the Summit team has real files to post:
 * add an entry with a `url` (a public file or Drive link) for each one.
 */
export const RESOURCES: Resource[] = [];
