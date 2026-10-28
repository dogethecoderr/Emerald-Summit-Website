// Client for the role-approvals Apps Script web app (apps-script/approvals.gs),
// which reads and writes the expert/volunteer sign-up sheet.

export type ApprovalStatus = 'not_found' | 'awaiting' | 'approved' | 'rejected';

export interface LookupResult {
  status: ApprovalStatus;
  /** Only returned once approved. */
  name?: string;
}

const APPROVALS_URL = import.meta.env.VITE_APPROVALS_URL;

export const isApprovalsConfigured = Boolean(APPROVALS_URL);

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!APPROVALS_URL) {
    throw new Error(
      'Sign-up backend is not configured. Set VITE_APPROVALS_URL ' +
        '(see apps-script/README.md).',
    );
  }
  // text/plain keeps this a "simple" request: Apps Script can't answer a
  // CORS preflight, which application/json would trigger.
  const res = await fetch(APPROVALS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sign-up backend returned ${res.status}.`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

export function lookupApproval(role: string, email: string): Promise<LookupResult> {
  return call<LookupResult>({
    action: 'lookup',
    role,
    email: email.trim().toLowerCase(),
  });
}

export function submitApplication(
  role: string,
  fields: Record<string, string>,
): Promise<{ status: ApprovalStatus }> {
  return call({ action: 'submit', role, fields });
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
