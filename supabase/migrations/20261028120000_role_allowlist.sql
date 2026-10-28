-- Emerald Summit: volunteer/admin allowlist synced from two Google Sheets.
-- Ported from the mobile app's role_allowlist_setup.sql, role_allowlist_v2.sql,
-- role_allowlist_email_fix.sql and allowlist_sync_secret.sql, adapted to this
-- project's public.users table and role enum.
--
-- Source of truth: the "Allowed Volunteers" and "Allowed Admins" sheets. The
-- sync-allowlist Edge Function copies them into public.role_allowlist every
-- minute. A trigger on public.users then refuses the gated roles (volunteer,
-- ambassador, admin) to anyone not listed, forcing them back to participant,
-- and owns the volunteer columns (subtype, scope, capability flags).
--
-- After running this file, once:
--   select secret from private.allowlist_sync;
--   supabase secrets set ALLOWLIST_SYNC_SECRET=<that value>
-- then deploy: supabase functions deploy sync-allowlist --no-verify-jwt

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1. Allowlist table
-- ---------------------------------------------------------------------------
-- One row per (email, role), so a person can be on both sheets. Capability
-- booleans are nullable on purpose: NULL means the sheet cell was blank and
-- the subtype default applies (see the trigger below).

create table if not exists public.role_allowlist (
  email                   text not null,
  role                    text not null check (role in ('volunteer', 'admin')),
  disciplines             text[] not null default '{}',
  subtype                 text check (subtype in ('eaf_ambassador', 'parent_volunteer', 'student_volunteer')),
  can_edit_sessions       boolean,
  can_post_announcements  boolean,
  can_check_in_front_desk boolean,
  updated_at              timestamptz not null default now(),
  primary key (email, role)
);

comment on table public.role_allowlist is
  'Synced from the Allowed Volunteers / Allowed Admins Google Sheets by the sync-allowlist Edge Function. Do not edit by hand.';

alter table public.role_allowlist enable row level security;

-- A signed-in user can read only their own rows (to learn their scope or show
-- "you aren't eligible"). Only the sync function (service role) writes.
drop policy if exists "role_allowlist_select_own" on public.role_allowlist;
create policy "role_allowlist_select_own"
  on public.role_allowlist
  for select
  to authenticated
  using (lower(email) = lower(auth.email()));

grant select on table public.role_allowlist to authenticated;
grant select, insert, update, delete on table public.role_allowlist to service_role;

-- ---------------------------------------------------------------------------
-- 2. Volunteer columns on users (owned by the trigger, never by the client)
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists volunteer_subtype       text,
  add column if not exists managed_disciplines     text[] not null default '{}',
  add column if not exists can_edit_sessions       boolean not null default false,
  add column if not exists can_post_announcements  boolean not null default false,
  add column if not exists can_check_in_front_desk boolean not null default false;

comment on column public.users.managed_disciplines is
  'Discipline ids a volunteer manages, from the sheet; {*} means every discipline.';

-- ---------------------------------------------------------------------------
-- 3. Enforcement trigger
-- ---------------------------------------------------------------------------
-- Runs on every insert and update of a user row:
--   * email is pinned to the sign-in email, so nobody can borrow an admin's
--     address by editing their own row
--   * volunteer / ambassador / admin not on the sheet -> participant
--   * ambassador needs a volunteer row with subtype eaf_ambassador
--   * volunteer / ambassador listed -> subtype, scope and flags from the sheet
--     (blank flags: ambassadors edit sessions by default, nothing else does;
--     announcements and front desk are opt-in)
--   * everyone else -> volunteer columns cleared
-- Because it recomputes on every update, re-touching a row (the reconcile
-- trigger below) demotes anyone removed from a sheet.

create or replace function public.enforce_role_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text;
  v_allow public.role_allowlist%rowtype;
begin
  select email into v_auth_email from auth.users where id = new.id;
  if v_auth_email is not null then
    new.email := v_auth_email;
  end if;

  new.volunteer_subtype       := null;
  new.managed_disciplines     := '{}';
  new.can_edit_sessions       := false;
  new.can_post_announcements  := false;
  new.can_check_in_front_desk := false;

  if new.role = 'admin'::public.user_role then
    if not exists (
      select 1 from public.role_allowlist
       where lower(email) = lower(new.email) and role = 'admin'
    ) then
      new.role := 'participant';
    end if;

  elsif new.role in ('volunteer'::public.user_role, 'ambassador'::public.user_role) then
    select * into v_allow from public.role_allowlist
     where lower(email) = lower(new.email) and role = 'volunteer';

    if not found
       or (new.role = 'ambassador'::public.user_role
           and v_allow.subtype is distinct from 'eaf_ambassador') then
      new.role := 'participant';
    else
      new.volunteer_subtype       := v_allow.subtype;
      new.managed_disciplines     := coalesce(v_allow.disciplines, '{}');
      new.can_edit_sessions       := coalesce(v_allow.can_edit_sessions,
                                              v_allow.subtype = 'eaf_ambassador');
      new.can_post_announcements  := coalesce(v_allow.can_post_announcements, false);
      new.can_check_in_front_desk := coalesce(v_allow.can_check_in_front_desk, false);
    end if;
  end if;

  return new;
end;
$$;

-- Named so it fires after users_enforce_update_rules (triggers run in name
-- order): that trigger rejects a role change the user asked for, and this one
-- may then demote quietly without tripping it.
drop trigger if exists users_role_allowlist on public.users;
create trigger users_role_allowlist
  before insert or update on public.users
  for each row
  execute function public.enforce_role_allowlist();

-- Sign-up may now ask for any role; the trigger above decides what is kept.
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Reconcile: re-apply the sheet to existing accounts
-- ---------------------------------------------------------------------------

create or replace function public.reconcile_users_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set updated_at = now()
   where lower(email) = lower(coalesce(new.email, old.email));
  return null;
end;
$$;

drop trigger if exists role_allowlist_reconcile on public.role_allowlist;
create trigger role_allowlist_reconcile
  after insert or update or delete on public.role_allowlist
  for each row
  execute function public.reconcile_users_from_allowlist();

-- ---------------------------------------------------------------------------
-- 5. Capability helpers for future policies
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_discipline(p_discipline text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
     where id = auth.uid()
       and (role = 'admin'
            or (role in ('volunteer', 'ambassador') and can_edit_sessions
                and (managed_disciplines @> array['*']
                     or managed_disciplines @> array[p_discipline])))
  );
$$;

create or replace function public.can_check_in_front_desk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
     where id = auth.uid()
       and (role = 'admin'
            or (role in ('volunteer', 'ambassador') and can_check_in_front_desk))
  );
$$;

grant execute on function public.can_manage_discipline(text) to authenticated;
grant execute on function public.can_check_in_front_desk() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cron: call sync-allowlist every minute with a shared secret
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.allowlist_sync (
  id           boolean primary key default true check (id),
  function_url text not null,
  secret       text not null
);
alter table private.allowlist_sync enable row level security;

-- Re-running keeps the existing secret.
insert into private.allowlist_sync (id, function_url, secret)
values (true,
        'https://spsxfbvamwxsmtjkwxko.supabase.co/functions/v1/sync-allowlist',
        encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

create or replace function private.flush_allowlist_sync()
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  cfg private.allowlist_sync%rowtype;
begin
  select * into cfg from private.allowlist_sync where id;
  if not found then
    return;
  end if;
  perform net.http_post(
    url := cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-sync-secret', cfg.secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function private.flush_allowlist_sync() from public, anon, authenticated;

select cron.unschedule('pull-from-sheets')
 where exists (select 1 from cron.job where jobname = 'pull-from-sheets');
select cron.schedule('pull-from-sheets', '* * * * *',
                     'select private.flush_allowlist_sync()');
