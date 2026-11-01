// Track lists per universe, sourced from the EHS Academic Foundation site:
// https://sites.google.com/view/ehs-academic-foundation/programs/emerald-summit
// and the app's knowledge base (genzarjun/Emerald-Summit-App-MOBILE,
// supabase/archie/knowledge.md). These are Summit '26's tracks; the '27 list
// isn't final. Keyed by DisciplineInfo.name (see disciplines.ts).

export type TrackFormat = 'Workshop' | 'Exhibit' | 'Presentation';

export interface TrackInfo {
  name: string;
  /** URL-safe id, e.g. 'law-rights'. */
  slug: string;
  /** DisciplineInfo.name of the verse it belongs to. */
  verse: string;
  /** One or two sentences on what the track covers. */
  about: string;
  /** What people bring or do there. */
  ideas: string[];
  formats: TrackFormat[];
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type Draft = Omit<TrackInfo, 'slug' | 'verse'>;

const DRAFTS: Record<string, Draft[]> = {
  techverse: [
    {
      name: 'Computer Science',
      about: 'Software, apps, and the ideas behind them, from algorithms to cybersecurity.',
      ideas: ['Show an app, game, or website you built', 'Explain a project or research question', 'Demo a tool and talk through the code'],
      formats: ['Exhibit', 'Presentation'],
    },
    {
      name: 'AI Playground',
      about: 'Hands-on time with machine learning and AI tools: what they can do, and where they fall short.',
      ideas: ['Train or test a small model', 'Try prompts and compare results', 'Talk through responsible use with experts'],
      formats: ['Workshop'],
    },
    {
      name: 'Engineering',
      about: 'Designs that solve physical problems, from circuits and mechanisms to full prototypes.',
      ideas: ['Bring a prototype or build log', 'Walk through your design decisions', 'Get feedback from working engineers'],
      formats: ['Exhibit', 'Presentation'],
    },
    {
      name: 'CADathon',
      about: 'A computer-aided design workshop: model a part or product to a brief, solo or in a team.',
      ideas: ['Model to a design brief', 'Iterate on feedback during the session', 'Present your model at the end'],
      formats: ['Workshop'],
    },
    {
      name: 'Robothon',
      about: 'A robotics workshop: build, wire, and program a robot to take on a task.',
      ideas: ['Build and program in a team', 'Debug sensors and motors', 'Demo what your robot can do'],
      formats: ['Workshop'],
    },
    {
      name: 'Product Design',
      about: 'Taking a product from a user need to a design: research, sketching, and prototyping.',
      ideas: ['Pitch a problem and your solution', 'Sketch and prototype quickly', 'Test ideas with other attendees'],
      formats: ['Workshop'],
    },
  ],
  biosphere: [
    {
      name: 'Psychology',
      about: 'How people think, feel, and behave, and how researchers study it.',
      ideas: ['Present a study or survey you ran', 'Explore a topic in behavior or the mind', 'Discuss research methods with experts'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Genetics',
      about: 'DNA, heredity, and tools like CRISPR, along with the ethics that come with them.',
      ideas: ['Present a genetics project or review', 'Explore gene editing and bioethics', 'Ask experts about lab and research paths'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Health Sciences',
      about: 'Medicine, public health, and the science of keeping people well.',
      ideas: ['Share a health research project', 'Explore a public health problem', 'Learn about careers in medicine'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Presentations',
      about: 'An open stage for life science work: present any BioSphere project and get expert feedback.',
      ideas: ['Present research or a science fair project', 'Practice a talk with a real audience', 'Get notes from experts afterward'],
      formats: ['Presentation'],
    },
  ],
  novasphere: [
    {
      name: 'Core Science',
      about: 'Physics, chemistry, astronomy, and math: the foundations, and where they lead.',
      ideas: ['Present an experiment or model', 'Explore space and physics questions', 'Work through problems with experts'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Climate Change & Sustainability',
      about: 'Understanding a changing climate and building solutions, local and global.',
      ideas: ['Share a sustainability project', 'Analyze climate data', 'Pitch a solution for your school or city'],
      formats: ['Workshop', 'Presentation'],
    },
  ],
  imaginex: [
    {
      name: 'Art',
      about: 'Visual art and design in any medium, from drawing and painting to film and digital work.',
      ideas: ['Exhibit a piece or portfolio', 'Present the process behind your work', 'Get critique from working artists'],
      formats: ['Exhibit', 'Presentation'],
    },
    {
      name: 'Literature',
      about: 'Writing and reading: fiction, poetry, essays, and the craft behind them.',
      ideas: ['Share a story, poem, or essay', 'Talk about a work you love', 'Get feedback on your writing'],
      formats: ['Exhibit', 'Presentation'],
    },
    {
      name: 'Music',
      about: 'Performing, composing, and producing music.',
      ideas: ['Perform or play a recording', 'Share a composition or production', 'Talk theory and process with musicians'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Culinary',
      about: 'Food as craft and science: recipes, techniques, and food culture.',
      ideas: ['Present a dish and its story', 'Explore the science of cooking', 'Learn techniques from experts'],
      formats: ['Workshop'],
    },
  ],
  ventureverse: [
    {
      name: 'Entrepreneurship',
      about: 'Turning an idea into a venture: problems, customers, business models, and money.',
      ideas: ['Pitch a startup or club idea', 'Build a simple business plan', 'Get feedback from founders and investors'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Marketing',
      about: 'Reaching people: brands, campaigns, social media, and what makes a message stick.',
      ideas: ['Present a campaign or brand you made', 'Analyze one that worked', 'Plan a launch with a team'],
      formats: ['Workshop', 'Presentation'],
    },
  ],
  civicverse: [
    {
      name: 'Mock Trial',
      about: 'A courtroom workshop: argue a case as attorneys and witnesses.',
      ideas: ['Prepare arguments in a team', 'Play attorney or witness', 'Hear feedback from legal experts'],
      formats: ['Workshop'],
    },
    {
      name: 'Civic Engagement',
      about: 'Making change in your community: organizing, service, and getting involved in government.',
      ideas: ['Present a service or advocacy project', 'Plan a community initiative', 'Meet local leaders'],
      formats: ['Workshop', 'Presentation'],
    },
    {
      name: 'Law & Rights',
      about: 'How laws are made and argued, and the rights they protect.',
      ideas: ['Debate a policy question', 'Present research on a case or right', 'Talk with lawyers about the field'],
      formats: ['Workshop', 'Presentation'],
    },
  ],
};

export const TRACKS: TrackInfo[] = Object.entries(DRAFTS).flatMap(([verse, list]) =>
  list.map((t) => ({ ...t, verse, slug: slugify(t.name) })),
);

/** Track names per universe, in display order. */
export const UNIVERSE_TRACKS: Record<string, string[]> = Object.fromEntries(
  Object.entries(DRAFTS).map(([verse, list]) => [verse, list.map((t) => t.name)]),
);

export function tracksForUniverse(name: string): string[] {
  return UNIVERSE_TRACKS[name] ?? [];
}

export function trackByName(verse: string, name: string): TrackInfo | undefined {
  return TRACKS.find((t) => t.verse === verse && t.name === name);
}

export const FORMAT_NOTES: Record<TrackFormat, string> = {
  Workshop: 'Hands-on, solo or in a team',
  Exhibit: 'Display your work and talk with visitors and experts',
  Presentation: 'Present to an audience and get expert feedback',
};
