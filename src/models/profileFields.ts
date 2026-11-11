// The sign-up questions each role answers, ported from the app's
// SummitRoleX.onboardingFields (lib/models/user_profile.dart). Answers land in
// profiles.details under each field's key, exactly like the app.
// Website role names: 'attendee' is the app's parentSpectator.

export interface ProfileField {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  helper?: string;
  /** More than one line, for a sentence-long answer. */
  multiline?: boolean;
  type?: 'text' | 'tel' | 'digits';
  /** The Tri-Valley school dropdown with an "Other" box. */
  schoolPicker?: boolean;
}

const PHONE_PRIVACY_NOTE = "Your number won't be shown publicly.";
const VOLUNTEER_PHONE_NOTE = 'Your phone number will be visible to other volunteers the day of for communication with them.';
const ADMIN_PHONE_NOTE = 'Your phone number will be visible to volunteers and other admins the day of for communication with them.';
const GRADE_NOTE = 'Goes on your volunteer hours record.';
const STUDENT_ID_NOTE = 'If you have one, it goes on your volunteer hours record.';

export const EXPERT_BIO_HINTS = [
  'I am a freelance graphic designer who builds brand identities for startups',
  'I am a robotics engineer who designs warehouse automation systems',
  'I am a biology researcher studying how coral reefs recover from bleaching',
  'I am a software developer who builds apps for local nonprofits',
  'I am a civil engineer who plans bike-friendly city streets',
];

/** The grade question for student volunteers and EAF ambassadors. */
export const VOLUNTEER_GRADE_FIELD: ProfileField = {
  key: 'grade', label: 'Grade', required: true, hint: 'e.g. 11', helper: GRADE_NOTE, type: 'digits',
};

export function onboardingFields(role: string | undefined): ProfileField[] {
  switch (role) {
    case 'volunteer':
    case 'ambassador':
      return [
        { key: 'phone', label: 'Mobile number', required: true, hint: 'For day-of coordination', helper: VOLUNTEER_PHONE_NOTE, type: 'tel' },
        { key: 'student_id', label: 'Student ID (optional)', hint: 'Numbers only', helper: STUDENT_ID_NOTE, type: 'digits' },
      ];
    case 'expert':
      return [
        { key: 'expertise', label: 'Area of expertise', required: true, hint: 'e.g. Robotics, Bioengineering' },
        { key: 'bio', label: 'One-line bio', required: true, multiline: true, hint: EXPERT_BIO_HINTS[0] },
        { key: 'phone', label: 'Mobile number (optional)', helper: `Only used to reach you on the day of the summit if necessary. ${PHONE_PRIVACY_NOTE}`, type: 'tel' },
      ];
    case 'attendee':
      return [
        { key: 'school', label: 'School (optional)', helper: "For a parent, your student's school.", schoolPicker: true },
      ];
    case 'admin':
      return [
        { key: 'phone', label: 'Mobile number', required: true, hint: 'For day-of coordination', helper: ADMIN_PHONE_NOTE, type: 'tel' },
        { key: 'student_id', label: 'Student ID (optional)', hint: 'Numbers only', helper: STUDENT_ID_NOTE, type: 'digits' },
        { key: 'grade', label: 'Grade (optional)', hint: 'e.g. 12', helper: GRADE_NOTE, type: 'digits' },
      ];
    default:
      return [
        { key: 'school', label: 'School', required: true, schoolPicker: true },
        { key: 'grade', label: 'Grade', required: true, hint: 'e.g. 11' },
        { key: 'phone', label: 'Mobile number (optional)', helper: PHONE_PRIVACY_NOTE, type: 'tel' },
      ];
  }
}

/** Student volunteers and EAF ambassadors must give a grade; parent volunteers don't. */
export function roleNeedsGrade(role: string | undefined, subtype: string | null | undefined): boolean {
  return (role === 'volunteer' || role === 'ambassador')
    && (subtype === 'student_volunteer' || subtype === 'eaf_ambassador');
}

/** The fields an account fills in: its role's, plus the volunteer grade when needed. */
export function formFields(role: string | undefined, subtype: string | null | undefined): ProfileField[] {
  const fields = onboardingFields(role);
  return roleNeedsGrade(role, subtype) && !fields.some((f) => f.key === 'grade')
    ? [...fields, VOLUNTEER_GRADE_FIELD]
    : fields;
}

export function requiresPhone(role: string | undefined): boolean {
  return role === 'volunteer' || role === 'ambassador' || role === 'admin';
}

type DetailsProfile = {
  role?: string;
  volunteer_subtype?: string | null;
  profile_setup_complete?: boolean;
  details?: Record<string, unknown> | null;
} | null | undefined;

const blank = (v: unknown) => v == null || String(v).trim() === '';

/**
 * What the app's auth gate still asks a signed-in account for: a phone for
 * volunteers and admins, and a grade for student volunteers and EAF
 * ambassadors. Null when nothing is missing.
 */
export function missingGateField(profile: DetailsProfile): 'phone' | 'grade' | null {
  if (!profile || profile.profile_setup_complete !== true) return null;
  const details = profile.details ?? {};
  if (requiresPhone(profile.role) && blank(details.phone)) return 'phone';
  if (roleNeedsGrade(profile.role, profile.volunteer_subtype) && blank(details.grade)) return 'grade';
  return null;
}
