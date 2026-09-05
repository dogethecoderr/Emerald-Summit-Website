-- Emerald Summit — user profiles + auth
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Sign-in itself is handled by Supabase Auth (email OTP for now, Google later).
-- Auth stores the account in the managed `auth.users` table, keyed to the
-- user's email. THIS file adds the app-facing `profiles` table: one row per
-- user holding their name, role, and role-specific details — the data every
-- device sees after signing in as that account.

-- 1. Table -------------------------------------------------------------------
-- `id` is the SAME uuid as auth.users.id, so a profile is permanently bound to
-- the account (and therefore the email). `details` is a flexible jsonb bag for
-- the role-specific onboarding answers (phone, school, org, emergency contact…)
-- so we can customize sign-up per role without a column per field.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text        not null default '',
  role        text        not null default 'participant',
  details     jsonb       not null default '{}'::jsonb,
  onboarded   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Row Level Security ------------------------------------------------------
-- Each signed-in user may read and write ONLY their own row. `auth.uid()` is
-- the id of the caller's session token, so the policy scopes every query to
-- that one account — the guarantee that user A can never see user B's profile.
alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3. Expose to the Data API --------------------------------------------------
-- This project has "Automatically expose new tables" turned OFF, so grant the
-- authenticated role access explicitly. (RLS above still restricts WHICH rows.)
grant select, insert, update on public.profiles to authenticated;

-- 4. Auto-create a profile row on sign-up ------------------------------------
-- When Supabase Auth creates a new account, this trigger drops a matching
-- (blank, onboarded = false) profile row in place. The app then fills it in
-- during onboarding. Runs as SECURITY DEFINER so it can write past RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Keep updated_at fresh ---------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- DASHBOARD STEPS (do these once, in addition to running this SQL):
--
--   a) Authentication → Providers → Email: make sure Email is ENABLED.
--      (Password can stay off — OTP is passwordless.)
--
--   b) Authentication → Email Templates → "Magic Link": ensure the body
--      includes the 6-digit code token, e.g. add this line:
--          <p>Your Emerald Summit code is: {{ .Token }}</p>
--      Without {{ .Token }} the email only contains a magic link and the
--      in-app "enter code" step has nothing to type.
--      NOTE: new free-tier projects (created after ~June 2026) CANNOT edit
--      templates on the built-in email service — template editing needs custom
--      SMTP (step b-1) or a paid plan. See step b-1.
--
--   b-1) Custom SMTP (required to edit templates on a new free project, and
--        required for production regardless — the built-in email service is
--        test-only and rate-limited to a few messages/hour):
--        Authentication → Settings → SMTP Settings → Enable Custom SMTP.
--        Fast dev option is Gmail SMTP (host smtp.gmail.com, port 587,
--        username = your Gmail, password = a Google *App Password*). For
--        production use a real domain + provider (Resend / SES / Brevo).
--
--   c) Authentication → Sign In / Providers → Email: keep "Allow new users to
--      sign up" ON (the default) so first-time OTP sign-in creates the account.
--
--   d) (For the later Google switch) Nothing to configure: Supabase AUTOMATICALLY
--      links identities that share the same CONFIRMED email. OTP confirms the
--      email inherently and Google emails are pre-verified, so signing in with
--      Google later lands on the SAME account as the OTP email — no data lost.
--      (Do NOT confuse this with "Enable Manual Linking" — that's for the
--      linkIdentity() API and is not needed here.)
-- ---------------------------------------------------------------------------
