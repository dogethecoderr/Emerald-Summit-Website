-- Sessions and registrations with independent participant and expert capacity.
-- This migration is standalone because this branch did not yet contain the
-- sessions_with_counts or register_for_session database objects.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  capacity integer not null default 0 check (capacity >= 0),
  expert_capacity integer not null default 3 check (expert_capacity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_registrations (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index session_registrations_session_idx
  on public.session_registrations (session_id);

create index session_registrations_user_idx
  on public.session_registrations (user_id);

create or replace view public.sessions_with_counts as
select
  s.*,
  count(r.user_id) filter (where u.role = 'participant')::integer as enrolled,
  count(r.user_id) filter (where u.role = 'expert')::integer as experts_enrolled
from public.sessions s
left join public.session_registrations r on r.session_id = s.id
left join public.users u on u.id = r.user_id
group by s.id;

create or replace function public.register_for_session(p_session_id uuid)
returns table (
  registered boolean,
  enrolled integer,
  capacity integer,
  experts_enrolled integer,
  expert_capacity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.user_role;
  session_row public.sessions%rowtype;
  already_registered boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to register';
  end if;

  select role into current_role
  from public.users
  where id = auth.uid();

  if current_role is null then
    raise exception 'A user profile is required to register';
  end if;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  select exists (
    select 1
    from public.session_registrations
    where session_id = p_session_id and user_id = auth.uid()
  ) into already_registered;

  if not already_registered then
    if current_role = 'expert' then
      if (
        select count(*)
        from public.session_registrations r
        join public.users u on u.id = r.user_id
        where r.session_id = p_session_id and u.role = 'expert'
      ) >= session_row.expert_capacity then
        raise exception 'Expert spots full';
      end if;
    elsif current_role = 'participant' then
      if (
        select count(*)
        from public.session_registrations r
        join public.users u on u.id = r.user_id
        where r.session_id = p_session_id and u.role = 'participant'
      ) >= session_row.capacity then
        raise exception 'Session full';
      end if;
    else
      raise exception 'This role cannot register for sessions';
    end if;

    insert into public.session_registrations (session_id, user_id)
    values (p_session_id, auth.uid());
  end if;

  return query
  select
    true,
    (select count(*)::integer from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id and u.role = 'participant'),
    session_row.capacity,
    (select count(*)::integer from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id and u.role = 'expert'),
    session_row.expert_capacity;
end;
$$;

create or replace function public.unregister_from_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.session_registrations
  where session_id = p_session_id and user_id = auth.uid();
$$;

alter table public.sessions enable row level security;
alter table public.session_registrations enable row level security;

create policy "sessions_select_authenticated"
  on public.sessions for select to authenticated using (true);

create policy "registrations_select_own"
  on public.session_registrations for select to authenticated
  using (user_id = auth.uid());

revoke all on public.session_registrations from anon, authenticated;
revoke execute on function public.register_for_session(uuid) from public;
revoke execute on function public.unregister_from_session(uuid) from public;
grant select on public.session_registrations to authenticated;
grant select on public.sessions to authenticated;
grant select on public.sessions_with_counts to authenticated;
grant execute on function public.register_for_session(uuid) to authenticated;
grant execute on function public.unregister_from_session(uuid) to authenticated;
