-- Emerald Summit: students' schedules are saved, and seats are real.
-- Run after 20261101140000_summit_tracks_sessions.sql.
--
-- Until now "my schedule" lived in the browser tab and vanished on reload,
-- and every session's seats taken were sample numbers. Now:
--   * session_reservations holds one row per (person, session): competing,
--     spectating, or judging
--   * the database refuses a full session and a second session in the same
--     time slot, even if two people click at once (the session row is locked)
--   * summit_sessions.enrolled / spectators / experts_enrolled are kept equal
--     to the reservations, so every page's seat counts are live
--   * the sample counts seeded with the sessions are reset to zero
-- Experts still sign in through the approvals sheet's local session, which
-- has no database credentials, so their judging picks stay in the browser.

create table if not exists public.session_reservations (
  user_id    uuid not null references public.users (id) on delete cascade,
  session_id text not null references public.summit_sessions (id) on delete cascade,
  kind       text not null check (kind in ('competing', 'spectating', 'judging')),
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

comment on table public.session_reservations is
  'Who is going to which session. Seat counts on summit_sessions follow it (reservation triggers).';

create index if not exists session_reservations_session_idx
  on public.session_reservations (session_id);

-- ---------------------------------------------------------------------------
-- Rules: capacity, time conflicts, who may take which kind of seat
-- ---------------------------------------------------------------------------

create or replace function public.check_session_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.summit_sessions%rowtype;
  v_role    public.user_role;
begin
  select role into v_role from public.users where id = new.user_id;
  if new.kind in ('competing', 'spectating') and v_role not in ('participant', 'attendee') then
    raise exception 'Only participants and attendees reserve seats.' using errcode = '42501';
  end if;
  if new.kind = 'competing' and v_role <> 'participant' then
    raise exception 'Only participants compete; attendees can spectate.' using errcode = '42501';
  end if;
  if new.kind = 'judging' and v_role <> 'expert' then
    raise exception 'Only experts judge.' using errcode = '42501';
  end if;

  -- Lock the session so two last-seat clicks can't both get in.
  select * into v_session from public.summit_sessions where id = new.session_id for update;
  if not found then
    raise exception 'That session no longer exists.';
  end if;

  if (new.kind = 'competing' and v_session.enrolled >= v_session.capacity)
     or (new.kind = 'spectating' and v_session.spectators >= v_session.spectator_cap)
     or (new.kind = 'judging' and v_session.experts_enrolled >= v_session.expert_capacity) then
    raise exception '% is full.', v_session.title using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.session_reservations r
      join public.summit_sessions s on s.id = r.session_id
     where r.user_id = new.user_id
       and r.session_id <> new.session_id
       and s.time_slot = v_session.time_slot
  ) then
    raise exception 'You already have a session at %.', v_session.time_slot using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists session_reservations_check on public.session_reservations;
create trigger session_reservations_check
  before insert on public.session_reservations
  for each row execute function public.check_session_reservation();

-- Keeps the session's counts equal to its reservations.
create or replace function public.count_session_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.session_reservations;
  v_delta integer;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_delta := 1;
  else
    v_row := old;
    v_delta := -1;
  end if;

  update public.summit_sessions
     set enrolled         = greatest(enrolled + case when v_row.kind = 'competing' then v_delta else 0 end, 0),
         spectators       = greatest(spectators + case when v_row.kind = 'spectating' then v_delta else 0 end, 0),
         experts_enrolled = greatest(experts_enrolled + case when v_row.kind = 'judging' then v_delta else 0 end, 0)
   where id = v_row.session_id;
  return null;
end;
$$;

drop trigger if exists session_reservations_count on public.session_reservations;
create trigger session_reservations_count
  after insert or delete on public.session_reservations
  for each row execute function public.count_session_reservation();

-- A seat-count change isn't an edit: keep the editor stamp for content only.
create or replace function public.stamp_summit_content()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'summit_sessions'
     and (to_jsonb(new) - array['enrolled', 'spectators', 'experts_enrolled', 'updated_at', 'updated_by'])
         = (to_jsonb(old) - array['enrolled', 'spectators', 'experts_enrolled', 'updated_at', 'updated_by']) then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: your own reservations only
-- ---------------------------------------------------------------------------

alter table public.session_reservations enable row level security;

drop policy if exists "session_reservations_select_own" on public.session_reservations;
create policy "session_reservations_select_own" on public.session_reservations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "session_reservations_select_admin" on public.session_reservations;
create policy "session_reservations_select_admin" on public.session_reservations
  for select to authenticated using (public.is_admin());

drop policy if exists "session_reservations_insert_own" on public.session_reservations;
create policy "session_reservations_insert_own" on public.session_reservations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "session_reservations_delete_own" on public.session_reservations;
create policy "session_reservations_delete_own" on public.session_reservations
  for delete to authenticated using (user_id = auth.uid());

revoke all on table public.session_reservations from anon, authenticated;
grant select, insert, delete on table public.session_reservations to authenticated;
grant all on table public.session_reservations to service_role;

-- ---------------------------------------------------------------------------
-- Start from real numbers: the seeded seat counts were samples.
-- ---------------------------------------------------------------------------

update public.summit_sessions s
   set enrolled         = (select count(*) from public.session_reservations r where r.session_id = s.id and r.kind = 'competing'),
       spectators       = (select count(*) from public.session_reservations r where r.session_id = s.id and r.kind = 'spectating'),
       experts_enrolled = (select count(*) from public.session_reservations r where r.session_id = s.id and r.kind = 'judging');
