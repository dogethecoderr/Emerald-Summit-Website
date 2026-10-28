# Role approvals: Apps Script backend

`approvals.gs` connects the expert and volunteer sign-up survey to the
"Emerald Summit App - Experts" Google Sheet. The app looks an email up in the
sheet, adds a survey row, and the script emails the applicant when an admin
approves them.

## One-time setup

1. Open the spreadsheet, then **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `approvals.gs` and save.
3. Set `APP_URL` near the top to where the app is hosted (leave
   `http://localhost:5173` for local testing).
4. In the function dropdown pick **setupTriggers** and click **Run**. Accept the
   permission prompt. This installs the trigger that sends approval emails.
5. **Deploy → New deployment**, type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the web app URL (ends in `/exec`) into the app's `.env.local`:

   ```
   VITE_APPROVALS_URL=https://script.google.com/macros/s/…/exec
   ```

   Restart `npm run dev` after changing env vars.

After editing the script later, use **Deploy → Manage deployments → Edit →
New version** so the same URL picks up the change.

## Sheet layout

One tab per role, named in `ROLE_SHEETS` (`Experts`, `Volunteers`). Row 1 holds
headers, and the script finds columns by header text, so their order doesn't
matter. It needs **Email** and **Approval Status**; every other survey column
(`FIELD_HEADERS`) is optional and is skipped if missing.

**Approval Status** values:

| Value | Meaning |
|---|---|
| Awaiting Approval | Set on every new submission. Sign-in is blocked. |
| Approved (or "Yes") | Sign-in works. Setting it emails the applicant. |
| Rejected (or "No") | Sign-in is blocked. |

## Adding the volunteer role

1. Duplicate the `Experts` tab and rename it `Volunteers`. Change the
   columns if volunteers need different questions, keeping **Email** and
   **Approval Status**.
2. Add a `volunteer` entry to `APPROVAL_SURVEYS` in
   `src/models/approvalSurveys.ts`. That entry is what switches the volunteer
   login page to the email step and survey.
3. If you added new questions, add each one to `FIELD_HEADERS` in
   `approvals.gs` and deploy a new version.

## Limits

This is a prototype. Anyone with the web app URL can add a row or check
an email's status, and an email typed on the login page is trusted without
verification. Before launch, the same check should run against the email
from a verified Google sign-in.
