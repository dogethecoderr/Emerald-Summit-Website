/**
 * Emerald Summit role approvals: Google Apps Script backend.
 *
 * Bound to the "Emerald Summit App - Experts" spreadsheet and deployed as a
 * web app. The React app POSTs JSON to it (as text/plain, so the browser sends
 * no CORS preflight) with one of two actions:
 *
 *   { action: 'lookup', role: 'expert', email }        -> { status, name? }
 *   { action: 'submit', role: 'expert', fields: {...} } -> { status }
 *
 * status is one of 'not_found' | 'awaiting' | 'approved' | 'rejected'.
 *
 * Each role has its own tab (ROLE_SHEETS). Columns are found by their header
 * text, not their position, so tabs can be reordered or given different
 * columns per role. A survey field is written only if its header exists.
 *
 * Setup: see apps-script/README.md.
 */

/** Role name (as used in the app) -> tab name. Add 'volunteer' once its tab exists. */
const ROLE_SHEETS = {
  expert: 'Experts',
  volunteer: 'Volunteers',
};

/** Survey field key sent by the app -> column header in the sheet. */
const FIELD_HEADERS = {
  email: 'Email',
  fullName: 'Full Name',
  phone: 'Phone',
  universe: 'Universe',
  track: 'Track',
  organization: 'Organization',
  jobTitle: 'Job Title',
  bio: 'Expertise / Bio',
  availability: 'Availability',
  linkedin: 'LinkedIn',
};

const SUBMITTED_AT_HEADER = 'Submitted At';
const STATUS_HEADER = 'Approval Status';
const REVIEWED_BY_HEADER = 'Reviewed By';

const STATUS_AWAITING = 'Awaiting Approval';

/** Where approved people are sent to sign in. Update when the app is deployed. */
const APP_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const sheet = sheetForRole_(body.role);

    if (body.action === 'lookup') {
      return json_(lookup_(sheet, body.email));
    }
    if (body.action === 'submit') {
      return json_(submit_(sheet, body.fields || {}));
    }
    return json_({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return json_({ error: String(err && err.message ? err.message : err) });
  }
}

/** A GET just confirms the deployment is reachable. */
function doGet() {
  return json_({ ok: true, roles: Object.keys(ROLE_SHEETS) });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function lookup_(sheet, email) {
  const target = normalizeEmail_(email);
  if (!target) throw new Error('Email is required.');

  const cols = headerIndex_(sheet);
  const row = findRowByEmail_(sheet, cols, target);
  if (!row) return { status: 'not_found' };

  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const status = normalizeStatus_(values[cols[STATUS_HEADER]]);
  const result = { status: status };
  // The name is only handed back once approved, so a lookup can't be used to
  // learn who has applied.
  if (status === 'approved' && cols[FIELD_HEADERS.fullName] !== undefined) {
    result.name = String(values[cols[FIELD_HEADERS.fullName]] || '');
  }
  return result;
}

function submit_(sheet, fields) {
  const email = normalizeEmail_(fields.email);
  if (!email) throw new Error('Email is required.');
  if (!String(fields.fullName || '').trim()) throw new Error('Full name is required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cols = headerIndex_(sheet);
    if (cols[STATUS_HEADER] === undefined) {
      throw new Error('Tab "' + sheet.getName() + '" has no "' + STATUS_HEADER + '" column.');
    }

    // A second submit (double click, back button) returns the existing row's
    // status instead of adding a duplicate.
    const existing = findRowByEmail_(sheet, cols, email);
    if (existing) {
      const status = sheet.getRange(existing, cols[STATUS_HEADER] + 1).getValue();
      return { status: normalizeStatus_(status) };
    }

    const row = new Array(sheet.getLastColumn()).fill('');
    Object.keys(FIELD_HEADERS).forEach(function (key) {
      const col = cols[FIELD_HEADERS[key]];
      if (col === undefined) return;
      const value = key === 'email' ? email : fields[key];
      row[col] = safeCell_(value);
    });
    if (cols[SUBMITTED_AT_HEADER] !== undefined) row[cols[SUBMITTED_AT_HEADER]] = new Date();
    row[cols[STATUS_HEADER]] = STATUS_AWAITING;

    sheet.appendRow(row);
    return { status: 'awaiting' };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Approval email (installable on-edit trigger; run setupTriggers once)
// ---------------------------------------------------------------------------

/**
 * Emails the applicant when an admin sets their Approval Status to an
 * approving value, and fills in Reviewed By if it's blank. A simple onEdit
 * can't send mail, so this must be installed with setupTriggers().
 */
function onApprovalEdit(e) {
  const sheet = e.range.getSheet();
  const role = roleForSheet_(sheet.getName());
  if (!role) return;

  const cols = headerIndex_(sheet);
  const statusCol = cols[STATUS_HEADER];
  if (statusCol === undefined) return;

  const firstCol = e.range.getColumn() - 1;
  const lastCol = firstCol + e.range.getNumColumns() - 1;
  if (statusCol < firstCol || statusCol > lastCol) return;

  const reviewer = (e.user && e.user.getEmail && e.user.getEmail()) || '';
  const firstRow = Math.max(e.range.getRow(), 2);
  const lastRow = e.range.getLastRow();

  for (let r = firstRow; r <= lastRow; r++) {
    const values = sheet.getRange(r, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (normalizeStatus_(values[statusCol]) !== 'approved') continue;

    const email = normalizeEmail_(values[cols[FIELD_HEADERS.email]]);
    if (!email) continue;
    const name = String(values[cols[FIELD_HEADERS.fullName]] || '').trim();

    sendApprovalEmail_(email, name, role);

    const reviewedCol = cols[REVIEWED_BY_HEADER];
    if (reviewedCol !== undefined && reviewer && !values[reviewedCol]) {
      sheet.getRange(r, reviewedCol + 1).setValue(reviewer);
    }
  }
}

function sendApprovalEmail_(email, name, role) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const greeting = name ? 'Hi ' + name.split(/\s+/)[0] + ',' : 'Hi,';
  MailApp.sendEmail({
    to: email,
    subject: 'You are approved as an Emerald Summit ' + roleLabel,
    body:
      greeting + '\n\n' +
      'Your ' + roleLabel.toLowerCase() + ' application for the Emerald Summit has been approved. ' +
      'You can now sign in with this email address:\n\n' +
      APP_URL + '/login/' + role + '\n\n' +
      'Emerald Summit team',
  });
}

/** Run once from the editor to install the approval-email trigger. */
function setupTriggers() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'onApprovalEdit'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onApprovalEdit').forSpreadsheet(ss).onEdit().create();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sheetForRole_(role) {
  const name = ROLE_SHEETS[role];
  if (!name) throw new Error('Role "' + role + '" does not use approvals.');
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Tab "' + name + '" does not exist yet.');
  return sheet;
}

function roleForSheet_(sheetName) {
  return Object.keys(ROLE_SHEETS).find(function (r) { return ROLE_SHEETS[r] === sheetName; });
}

/** Header text -> 0-based column index, from row 1. */
function headerIndex_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = {};
  headers.forEach(function (h, i) {
    const key = String(h).trim();
    if (key) index[key] = i;
  });
  return index;
}

/** 1-based row number of the first row whose Email matches, or 0. */
function findRowByEmail_(sheet, cols, email) {
  const emailCol = cols[FIELD_HEADERS.email];
  if (emailCol === undefined) throw new Error('Tab "' + sheet.getName() + '" has no Email column.');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const emails = sheet.getRange(2, emailCol + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < emails.length; i++) {
    if (normalizeEmail_(emails[i][0]) === email) return i + 2;
  }
  return 0;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

/** Admins may type "Yes"/"No" instead of picking from the dropdown. */
function normalizeStatus_(value) {
  const s = String(value || '').trim().toLowerCase();
  if (['approved', 'approve', 'yes', 'y', 'true'].indexOf(s) !== -1) return 'approved';
  if (['rejected', 'reject', 'denied', 'no', 'n', 'false'].indexOf(s) !== -1) return 'rejected';
  return 'awaiting';
}

/**
 * Text from the survey is stored as text: a leading = + - @ would otherwise
 * be read as a formula (and "+1 555…" phone numbers would break).
 */
function safeCell_(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
