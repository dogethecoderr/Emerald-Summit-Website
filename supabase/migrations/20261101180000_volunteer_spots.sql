-- Emerald Summit: volunteers sign up for sessions too.
-- Run after 20261101160000_session_reservations.sql.
--
-- Each session gets volunteer spots next to its competitor, spectator, and
-- expert seats. Volunteers (and ambassadors) pick sessions to help at from
-- the Schedule tab; the same reservation rules apply (a full session, or a
-- second session in one time slot, is refused) and the count stays live.

alter table public.summit_sessions
  add column if not exists volunteer_capacity integer not null default 2 check (volunteer_capacity >= 0),
  add column if not exists volunteers_enrolled integer not null default 0 check (volunteers_enrolled >= 0);

alter table public.session_reservations
  drop constraint if exists session_reservations_kind_check;
alter table public.session_reservations
  add constraint session_reservations_kind_check
  check (kind in ('competing', 'spectating', 'judging', 'volunteering'));

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
  if new.kind = 'volunteering' and v_role not in ('volunteer', 'ambassador') then
    raise exception 'Only volunteers sign up to help.' using errcode = '42501';
  end if;

  -- Lock the session so two last-spot clicks can't both get in.
  select * into v_session from public.summit_sessions where id = new.session_id for update;
  if not found then
    raise exception 'That session no longer exists.';
  end if;

  if (new.kind = 'competing' and v_session.enrolled >= v_session.capacity)
     or (new.kind = 'spectating' and v_session.spectators >= v_session.spectator_cap)
     or (new.kind = 'judging' and v_session.experts_enrolled >= v_session.expert_capacity)
     or (new.kind = 'volunteering' and v_session.volunteers_enrolled >= v_session.volunteer_capacity) then
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
     set enrolled            = greatest(enrolled + case when v_row.kind = 'competing' then v_delta else 0 end, 0),
         spectators          = greatest(spectators + case when v_row.kind = 'spectating' then v_delta else 0 end, 0),
         experts_enrolled    = greatest(experts_enrolled + case when v_row.kind = 'judging' then v_delta else 0 end, 0),
         volunteers_enrolled = greatest(volunteers_enrolled + case when v_row.kind = 'volunteering' then v_delta else 0 end, 0)
   where id = v_row.session_id;
  return null;
end;
$$;

-- A seat-count change isn't an edit: keep the editor stamp for content only.
create or replace function public.stamp_summit_content()
returns trigger
language plpgsql
as $$
declare
  v_counts text[] := array['enrolled', 'spectators', 'experts_enrolled', 'volunteers_enrolled', 'updated_at', 'updated_by'];
begin
  if tg_table_name = 'summit_sessions'
     and (to_jsonb(new) - v_counts) = (to_jsonb(old) - v_counts) then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
