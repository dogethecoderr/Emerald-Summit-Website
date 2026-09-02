# Connecting the Supabase backend (connectivity test)

Goal: prove the app pulls live data from your Supabase project. We use the
`announcements` table as the test — the **News** tab reads it live and shows a
banner telling you whether the data is live or local sample data.

## What you do in Supabase

### 1. Create the table + sample data
1. Open your project at https://supabase.com/dashboard.
2. Left sidebar → **SQL Editor** → **New query**.
3. Open [`supabase/announcements_setup.sql`](supabase/announcements_setup.sql)
   from this repo, copy all of it, paste into the editor, and click **Run**.
   - This creates `announcements`, enables Row Level Security with a
     **public read** policy, and inserts three sample rows.
4. Confirm it worked: left sidebar → **Table Editor** → `announcements` should
   show three rows.

### 2. Copy your project credentials
1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Project API keys → `anon` `public`** (may be labeled **Publishable
     key**) — a long token.
3. ⚠️ Do **not** copy the `service_role` / **secret** key. That one bypasses
   security and must never go in the app. I only need the anon/public one.

### 3. Give me the two values
Paste the **Project URL** and the **anon/public key** into
[`lib/supabase_config.dart`](lib/supabase_config.dart) (replace the two
`PASTE_...` placeholders), or just paste them to me in chat and I'll drop them
in. The anon key is designed to live in client apps, so this is safe.

## What happens next (my side)
Once the credentials are in, I'll rebuild and run the app. On the **News** tab
you'll see:
- a green **"Live from Supabase · N announcements"** banner, and
- the three rows served from your database (not the bundled sample data).

Edit or add a row in the Supabase Table Editor, tap **refresh** in the app, and
the change shows up — that's the end-to-end proof the backend is connected.

## How this maps to the real app
`announcements` matches the table in the spec (section 05). Once this test
passes, the same pattern extends to the other tables — `activities`,
`registrations`, `users`, etc. — swapping each screen's sample data for a
Supabase query, and adding role-based RLS policies.
