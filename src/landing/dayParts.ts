import { FORMAT_NOTES } from '../models/tracks';

/**
 * The Summit day from the peak down: one terrace of the Summit figure
 * each. Every line is a fact the site or the app already states (the FAQ,
 * FORMAT_NOTES, the hours, the QR pass); what nobody has published yet is a
 * `pending` line, shown as a blank to fill rather than made up.
 */
export interface DayPart {
  name: string;
  points: string[];
  /** A fact not announced yet, shown as a visible blank. */
  pending?: string;
  photo?: { n: number; alt: string };
}

export const DAY_PARTS: DayPart[] = [
  {
    name: 'Check-in',
    points: [
      'One tap at the front desk',
      'Your pass lives in the Emerald Summit app',
      'The day runs 9 AM to 5 PM',
    ],
    photo: { n: 1, alt: 'The lit EHS letters at the Emerald High entrance' },
  },
  {
    name: 'Opening keynote',
    points: [
      'The whole Summit together before the sessions begin',
      'Last year’s keynote speaker was Sabeer Bhatia',
    ],
    pending: 'This year’s speaker to be announced',
    photo: { n: 8, alt: 'A speaker addresses the Summit from the gym floor' },
  },
  {
    name: 'Workshops',
    points: [
      FORMAT_NOTES.Workshop,
      'Come on your own or with a team',
      'No technical background needed',
    ],
    photo: { n: 10, alt: 'Students gather around a robot they built' },
  },
  {
    name: 'Presentations and exhibits',
    points: [
      FORMAT_NOTES.Presentation,
      FORMAT_NOTES.Exhibit,
      '30+ visiting experts give feedback',
    ],
    photo: { n: 19, alt: 'Two students show their project to a visiting expert' },
  },
  {
    name: 'Lunch',
    points: [],
    pending: 'Time and menu to be announced',
  },
  {
    name: 'Landing',
    points: [
      'Everyone back together in the gym',
      'Take home the feedback from your sessions',
      'The day wraps by 5 PM',
    ],
    photo: { n: 26, alt: 'Students and families fill the gym bleachers' },
  },
];
