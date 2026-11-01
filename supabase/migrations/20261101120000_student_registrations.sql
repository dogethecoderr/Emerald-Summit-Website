-- Emerald Summit: what a student tells us when they register.
-- Run after 20261028160000_switch_role_at_sign_in.sql.
--
-- Profile setup for participants is three steps (src/pages/ProfileSetupPage.tsx):
--   1. About you   -> name, phone, bio (on users); grade, school (here)
--   2. Team        -> solo, or a team name and teammates' names (here)
--   3. Project     -> planned verse (users.discipline, the only one shown in
--                     the app), track, project title and overview (here)
--
-- These live in their own table rather than on users because users is
-- readable by every signed-in person (users_select_directory). Here:
--   * a student reads, creates, and updates only their own row
--   * admins (public.is_admin(), i.e. role = admin from the Allowed Admins
--     sheet) read every row
--   * nobody else reads anything; the service role and the dashboard see all
-- Every column is optional, so registration still finishes without them.

create table if not exists public.student_registrations (
  user_id          uuid primary key references public.users (id) on delete cascade,
  grade            smallint,
  school           text,
  team_name        text,
  teammates        text[] not null default '{}',
  track            text,
  project_title    text,
  project_overview text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint student_registrations_grade_range
    check (grade is null or grade between 9 and 12),
  constraint student_registrations_teammates_limit
    check (coalesce(array_length(teammates, 1), 0) <= 4),
  constraint student_registrations_overview_length
    check (project_overview is null or char_length(project_overview) <= 1000)
);

comment on table public.student_registrations is
  'Team, track, and project a participant gives at registration. Stored for the Summit team; only the student and admins can read a row.';
comment on column public.student_registrations.teammates is
  'Names of the other people on the team (up to 4). Empty when competing solo.';
comment on column public.student_registrations.track is
  'Planned track name within users.discipline, from src/models/tracks.ts. Reserves no sessions.';

drop trigger if exists student_registrations_set_updated_at on public.student_registrations;
create trigger student_registrations_set_updated_at
  before update on public.student_registrations
  for each row
  execute function public.set_updated_at();

alter table public.student_registrations enable row level security;

drop policy if exists "student_registrations_select_own" on public.student_registrations;
create policy "student_registrations_select_own"
  on public.student_registrations
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "student_registrations_select_admin" on public.student_registrations;
create policy "student_registrations_select_admin"
  on public.student_registrations
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "student_registrations_insert_own" on public.student_registrations;
create policy "student_registrations_insert_own"
  on public.student_registrations
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "student_registrations_update_own" on public.student_registrations;
create policy "student_registrations_update_own"
  on public.student_registrations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Supabase's default privileges grant everything on new public tables to anon
-- and authenticated. TRUNCATE ignores RLS, so take it all back and grant only
-- what the policies above use.
revoke all on table public.student_registrations from anon, authenticated;
grant select, insert, update on table public.student_registrations to authenticated;
grant select, insert, update, delete on table public.student_registrations to service_role;
