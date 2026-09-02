-- Emerald Summit — backend connectivity test
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It creates the `announcements` table, allows public read access (so the
-- app's anon key can fetch), and inserts three sample rows.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  author      text not null default 'Summit Admin',
  audience    text not null default 'Everyone',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 2. Row Level Security ------------------------------------------------------
-- Enable RLS, then add a policy that lets anyone READ. The app uses the public
-- anon/publishable key, which maps to the `anon` role. Read-only is safe here;
-- no insert/update/delete policy means the public key cannot modify data.
alter table public.announcements enable row level security;

drop policy if exists "Public read access" on public.announcements;
create policy "Public read access"
  on public.announcements
  for select
  to anon, authenticated
  using (true);

-- 3. Sample data -------------------------------------------------------------
insert into public.announcements (title, body, author, audience, pinned) values
  ('Welcome to Emerald Summit ''27!',
   'Doors open at 8:30 AM. Check in at the main entrance, then head to the opening ceremony in the auditorium at 9:00 AM.',
   'Summit Admin', 'Everyone', true),
  ('Room change: Robotics Showcase',
   'The Autonomous Robot Showcase has moved from Gym B to Gym A. Your schedule has been updated automatically.',
   'RoboSphere Team', 'RoboSphere', false),
  ('Lunch is served in the quad',
   'Grab-and-go lunch is available from 12:00–1:00 PM in the quad.',
   'Summit Admin', 'Everyone', false);
