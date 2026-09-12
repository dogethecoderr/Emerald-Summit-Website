// User roles for the Emerald Summit web prototype. Mirrors the roles used in
// the separate Emerald Summit Flutter app so the two stay conceptually aligned.
import {
  GraduationCap,
  HeartHandshake,
  Award,
  ShieldCheck,
  Eye,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface RoleInfo {
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Badge/pill accent color, e.g. for the directory-style role pill. */
  color: string;
}

export const USER_ROLES: RoleInfo[] = [
  {
    name: 'participant',
    label: 'Participant',
    description:
      'Build your schedule, register for tracks, and follow your day.',
    icon: GraduationCap, // school_outlined
    color: '#0EA5E9',
  },
  {
    name: 'attendee',
    label: 'Attendee',
    description: 'Explore the Summit, browse event updates, and see what is happening.',
    icon: Eye,
    color: '#2563EB',
  },
  {
    name: 'ambassador',
    label: 'Ambassador',
    description:
      'Edit activity pages, post announcements, and log volunteer hours.',
    icon: HeartHandshake, // volunteer_activism_outlined
    color: '#F59E0B',
  },
  {
    name: 'admin',
    label: 'Admin',
    description:
      'Post and edit announcements, share files, and broadcast Summit news.',
    icon: ShieldCheck, // admin_panel_settings_outlined
    color: '#0C7A55',
  },
  {
    name: 'volunteer',
    label: 'Volunteer',
    description:
      'Manage your assigned track, check in participants, and support Summit attendees.',
    icon: Users,
    color: '#E11D48',
  },
  {
    name: 'expert',
    label: 'Expert',
    description: 'View your judging assignments and navigate between rooms.',
    icon: Award, // workspace_premium_outlined
    color: '#7C3AED',
  },
];

/**
 * Roles that can sign in to the app. Ambassadors are still coordinated
 * offline; they stay in USER_ROLES so directory listings label those people
 * correctly. Admins sign in because they author announcements in-app.
 */
export const SIGN_IN_ROLES: RoleInfo[] = USER_ROLES.filter(
  (r) => r.name !== 'ambassador',
);

export function roleByName(name: string | undefined): RoleInfo | undefined {
  if (!name) return undefined;
  return USER_ROLES.find((r) => r.name === name);
}
