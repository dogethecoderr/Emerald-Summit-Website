// Each verse's personality: palette, animated background motif, and how the
// liquid border flows around its page. Ported value for value from the mobile
// app (genzarjun/Emerald-Summit-App-MOBILE, lib/widgets/discipline_vibe.dart)
// so a verse looks the same on the phone and the web.
import {
  ChartLine,
  CircuitBoard,
  Dna,
  Orbit,
  Paintbrush,
  Scale,
  Sparkles,
  DISCIPLINE_ICONS,
  type LucideIcon,
} from '@/components/icons';
import { USER_DISCIPLINES, type DisciplineInfo } from './disciplines';

export type VerseMotif = 'circuit' | 'ticker' | 'cells' | 'stars' | 'ripples' | 'paint';

export interface FlowStyle {
  /** Wave height in px. */
  amplitude: number;
  /** How far the calm water line sits in from the edge, in px. */
  depth: number;
  /** Wave crests around the whole perimeter. */
  waves: number;
  /** How fast the crests travel around the edge. */
  speed: number;
  /** How fast the colors rotate around the edge (turns per second). */
  spin: number;
  /** Bright dots carried along the water line. */
  sparks: number;
  /** Swells in a lub-dub rhythm instead of a steady flow. */
  heartbeat: boolean;
}

export interface VerseVibe {
  /** Page canvas: each verse is its own little world, dark or light. */
  background: string;
  /** Cards and raised panels on the background. */
  surface: string;
  /** Main highlight: buttons, meters, selected chips. */
  accent: string;
  /** Second highlight for gradients and small details. */
  accent2: string;
  motif: VerseMotif;
  flow: FlowStyle;
  /** Colors carried around the edge by the border flow. */
  flowColors: string[];
  icon: LucideIcon;
  /** Body text and secondary text on the background. */
  text: string;
  textDim: string;
  /** Glints in the motifs and border sparks (white on dark). */
  highlight: string;
  /** Empty part of meters. */
  meter: string;
}

export const VERSE_TEXT = '#F2F5F7';
export const VERSE_TEXT_DIM = '#B9C2CC';

const DARK_INK = {
  text: VERSE_TEXT,
  textDim: VERSE_TEXT_DIM,
  highlight: '#FFFFFF',
  meter: 'rgba(255,255,255,0.14)',
};

const flow = (f: Partial<FlowStyle> & Pick<FlowStyle, 'amplitude' | 'depth' | 'waves' | 'speed' | 'spin'>): FlowStyle => ({
  sparks: 0,
  heartbeat: false,
  ...f,
});

export const VERSE_VIBES: Record<string, VerseVibe> = {
  techverse: {
    background: '#050B18',
    surface: '#0E1A31',
    accent: '#80DED9',
    accent2: '#6D9DC5',
    motif: 'circuit',
    flow: flow({ amplitude: 9, depth: 5, waves: 7, speed: 1.6, spin: 0.22, sparks: 6 }),
    flowColors: ['#119DA4', '#254F93', '#6D9DC5', '#80DED9'],
    icon: CircuitBoard,
    ...DARK_INK,
  },
  ventureverse: {
    background: '#12080D',
    surface: '#26141C',
    accent: '#FFA552',
    accent2: '#FCDE9C',
    motif: 'ticker',
    flow: flow({ amplitude: 5, depth: 4, waves: 12, speed: 2.4, spin: 0.35, sparks: 8 }),
    flowColors: ['#FFA552', '#FCDE9C', '#BA5624', '#381D2A'],
    icon: ChartLine,
    ...DARK_INK,
  },
  biosphere: {
    background: '#0C0E05',
    surface: '#1A1E0C',
    accent: '#B6C454',
    accent2: '#E6D3A3',
    motif: 'cells',
    flow: flow({ amplitude: 7, depth: 6, waves: 5, speed: 0.9, spin: 0.08, heartbeat: true }),
    flowColors: ['#B6C454', '#D8D174', '#E6D3A3', '#F6FEDB'],
    icon: Dna,
    ...DARK_INK,
  },
  novasphere: {
    background: '#020C07',
    surface: '#0A1D13',
    accent: '#8FD5A6',
    accent2: '#E5C2C0',
    motif: 'stars',
    flow: flow({ amplitude: 14, depth: 7, waves: 3, speed: 0.5, spin: 0.07, sparks: 3 }),
    flowColors: ['#8FD5A6', '#329F5B', '#0C8346', '#E5C2C0'],
    icon: Orbit,
    ...DARK_INK,
  },
  civicverse: {
    background: '#0D0412',
    surface: '#1E0B25',
    accent: '#DCCCA3',
    accent2: '#824C71',
    motif: 'ripples',
    flow: flow({ amplitude: 3, depth: 4, waves: 4, speed: 0.6, spin: 0.05 }),
    flowColors: ['#DCCCA3', '#824C71', '#4A2545', '#2B0539'],
    icon: Scale,
    ...DARK_INK,
  },
  imaginex: {
    background: '#0F0A16',
    surface: '#1E1729',
    accent: '#A6B1E1',
    accent2: '#DCD6F7',
    motif: 'paint',
    flow: flow({ amplitude: 11, depth: 6, waves: 6, speed: 1.2, spin: 0.45, sparks: 4 }),
    flowColors: ['#DCD6F7', '#A6B1E1', '#B4869F', '#805D93'],
    icon: Paintbrush,
    ...DARK_INK,
  },
};

/** House style for verses added later. */
export const EMERALD_VIBE: VerseVibe = {
  background: '#02120C',
  surface: '#0B241B',
  accent: '#7FE0B5',
  accent2: '#101C36',
  motif: 'ripples',
  flow: flow({ amplitude: 6, depth: 5, waves: 5, speed: 0.9, spin: 0.12, sparks: 2 }),
  flowColors: ['#7FE0B5', '#101C36', '#14B8A6'],
  icon: Sparkles,
  ...DARK_INK,
};

/**
 * Light mode: the same worlds by day. Each verse keeps its hue but sits on a
 * pale tint of it (TechVerse goes from deep navy to light blue), with deeper
 * accents so the motifs and text still read on the lighter canvas.
 */
const LIGHT: Record<string, Pick<VerseVibe, 'background' | 'surface' | 'accent' | 'accent2' | 'flowColors'>> = {
  techverse: {
    background: '#CDEBF5',
    surface: '#F3FAFD',
    accent: '#0B7F88',
    accent2: '#2F5FA8',
    flowColors: ['#119DA4', '#254F93', '#6D9DC5', '#3FBFB8'],
  },
  ventureverse: {
    background: '#FFE0C4',
    surface: '#FFF8F0',
    accent: '#C2551B',
    accent2: '#C98A1E',
    flowColors: ['#FFA552', '#E0A43A', '#BA5624', '#7A3A4E'],
  },
  biosphere: {
    background: '#E6EEBF',
    surface: '#FAFCEC',
    accent: '#5F7012',
    accent2: '#9A7F3C',
    flowColors: ['#8C9C2A', '#B6C454', '#C2A866', '#6E7D1B'],
  },
  novasphere: {
    background: '#CDEDD9',
    surface: '#F2FBF5',
    accent: '#0C7A42',
    accent2: '#B0605B',
    flowColors: ['#3FB06A', '#329F5B', '#0C8346', '#D19A97'],
  },
  civicverse: {
    background: '#EEDDE9',
    surface: '#FCF7FA',
    accent: '#7E3F6B',
    accent2: '#93753A',
    flowColors: ['#C2A86B', '#824C71', '#4A2545', '#A86F95'],
  },
  imaginex: {
    background: '#DCDFF8',
    surface: '#F7F7FE',
    accent: '#4F5AA6',
    accent2: '#805D93',
    flowColors: ['#A6B1E1', '#6F7CC4', '#B4869F', '#805D93'],
  },
};

const EMERALD_LIGHT: (typeof LIGHT)[string] = {
  background: '#D0EEDD',
  surface: '#F3FBF7',
  accent: '#0C7A55',
  accent2: '#1E3A6B',
  flowColors: ['#34D399', '#1E3A6B', '#14B8A6'],
};

const LIGHT_INK = {
  text: '#16211C',
  textDim: '#4F5B63',
  meter: 'rgba(22,33,28,0.1)',
};

export function vibeFor(id: string | undefined | null, theme: 'light' | 'dark' = 'dark'): VerseVibe {
  const key = id?.toLowerCase();
  // A discipline added after the six gets the emerald world with its own icon.
  const added = key && !VERSE_VIBES[key] ? USER_DISCIPLINES.find((d) => d.name === key) : undefined;
  const dark = (key && VERSE_VIBES[key]) || (added ? { ...EMERALD_VIBE, icon: DISCIPLINE_ICONS[added.icon ?? ''] ?? EMERALD_VIBE.icon } : EMERALD_VIBE);
  if (theme === 'dark') return dark;
  const light = (key && LIGHT[key]) || EMERALD_LIGHT;
  return { ...dark, ...light, ...LIGHT_INK, highlight: light.accent2 };
}

/** `#RRGGBB` plus alpha as an rgba() string. */
export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Mix two `#RRGGBB` colors; t = 0 gives a, 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/**
 * The six verses with `color` set to each verse's accent, for anything drawn
 * on a dark background (the landing hero's dots and orbit) so it matches
 * Explore the verses. The plain USER_DISCIPLINES colors stay for light
 * surfaces, where these lighter accents would be too faint.
 */
export const VERSE_DISCIPLINES: DisciplineInfo[] = USER_DISCIPLINES.map((d) => ({
  ...d,
  color: vibeFor(d.name).accent,
}));
