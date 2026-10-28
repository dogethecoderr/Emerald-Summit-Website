// First-time sign-up surveys for roles that need an admin's approval before
// they can sign in. Each field `key` must match a key in FIELD_HEADERS in
// apps-script/approvals.gs, which maps it to a column of that role's tab.
//
// To gate another role (e.g. volunteer), add an entry here and a tab for it in
// the sheet; see apps-script/README.md.

export type SurveyFieldType =
  | 'text'
  | 'tel'
  | 'url'
  | 'textarea'
  /** Universe picker; submitted as the universe label, e.g. "TechVerse". */
  | 'universe'
  /** Track picker scoped to the chosen universe (needs a 'universe' field). */
  | 'track';

export interface SurveyField {
  key: string;
  label: string;
  type: SurveyFieldType;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

export interface ApprovalSurvey {
  title: string;
  intro: string;
  fields: SurveyField[];
}

export const APPROVAL_SURVEYS: Record<string, ApprovalSurvey> = {
  expert: {
    title: 'Apply to be a Summit expert',
    intro:
      'Tell us about yourself and where you would like to judge. An admin ' +
      'reviews every application, and we will email you once you are approved.',
    fields: [
      { key: 'fullName', label: 'Full name', type: 'text', required: true, placeholder: 'Jordan Lee', autoComplete: 'name' },
      { key: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '(555) 123-4567', autoComplete: 'tel' },
      { key: 'universe', label: 'Universe', type: 'universe', required: true },
      { key: 'track', label: 'Track', type: 'track', required: true },
      { key: 'organization', label: 'Organization', type: 'text', required: true, placeholder: 'Company, university, or school', autoComplete: 'organization' },
      { key: 'jobTitle', label: 'Job title', type: 'text', placeholder: 'Senior Engineer', autoComplete: 'organization-title' },
      { key: 'bio', label: 'Expertise / bio', type: 'textarea', required: true, placeholder: 'Your background and what you can help students with.' },
      { key: 'availability', label: 'Availability on Summit day', type: 'text', placeholder: 'All day, mornings only, …' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/in/…' },
    ],
  },
};

export function surveyForRole(roleName: string | undefined): ApprovalSurvey | undefined {
  return roleName ? APPROVAL_SURVEYS[roleName] : undefined;
}

/** Roles that sign in by email and need an approved row in the sheet. */
export function requiresApproval(roleName: string | undefined): boolean {
  return surveyForRole(roleName) !== undefined;
}
