alter table public.users
  add column is_front_desk boolean not null default false,
  add column is_volunteer boolean not null default false;

comment on column public.users.is_front_desk is
  'Admin-managed permission for volunteers to access the global check-in roster.';
comment on column public.users.is_volunteer is
  'Admin-managed additional volunteer role for users whose primary role remains participant or attendee.';

create table public.summit_tracks (
  name text primary key,
  label text not null,
  color text not null default '#0C7A55',
  is_discipline boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.summit_tracks (name, label, color)
values
  ('techverse', 'TechVerse', '#3B82F6'),
  ('biosphere', 'BioSphere', '#14B8A6'),
  ('imaginex', 'ImagineX', '#E11D48'),
  ('novasphere', 'NovaSphere', '#7C3AED'),
  ('ventureverse', 'VentureVerse', '#F59E0B'),
  ('civicverse', 'CivicVerse', '#F97316')
on conflict (name) do nothing;

insert into public.summit_tracks (name, label, color, is_discipline)
values ('keynote', 'Keynote', '#0C7A55', false)
on conflict (name) do nothing;

alter table public.users
  alter column discipline type text using discipline::text;

alter table public.users
  add constraint users_discipline_track_fk
  foreign key (discipline) references public.summit_tracks (name) on delete set null;

alter table public.summit_tracks enable row level security;

create policy "summit_tracks_select_authenticated"
  on public.summit_tracks for select to authenticated using (true);

create policy "summit_tracks_admin_manage"
  on public.summit_tracks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.summit_tracks to authenticated;
grant insert, update, delete on public.summit_tracks to authenticated;

create or replace function public.enforce_users_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if auth.uid() = new.id then
    if new.role = 'admin'::public.user_role then
      raise exception 'Cannot self-assign admin role';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Cannot change role; contact an admin';
    end if;
    if new.is_front_desk is distinct from old.is_front_desk then
      raise exception 'Only an admin can change front-desk access';
    end if;
    if new.is_volunteer is distinct from old.is_volunteer then
      raise exception 'Only an admin can assign volunteer access';
    end if;
    if (old.role = 'volunteer'::public.user_role or old.is_volunteer)
      and new.discipline is distinct from old.discipline then
      raise exception 'Only an admin can change a volunteer track assignment';
    end if;
    if new.checked_in_at is distinct from old.checked_in_at then
      raise exception 'Cannot self check-in; see an admin at the front desk';
    end if;
    return new;
  end if;

  if public.is_volunteer() then
    if new.id is distinct from old.id
      or new.name is distinct from old.name
      or new.role is distinct from old.role
      or new.email is distinct from old.email
      or new.phone is distinct from old.phone
      or new.discipline is distinct from old.discipline
      or new.is_front_desk is distinct from old.is_front_desk
      or new.is_volunteer is distinct from old.is_volunteer
      or new.bio is distinct from old.bio
      or new.profile_setup_complete is distinct from old.profile_setup_complete
      or new.created_at is distinct from old.created_at then
      raise exception 'Volunteers are only permitted to update checked_in_at';
    end if;
    return new;
  end if;

  raise exception 'Permission denied: cannot update other users';
end;
$$;

create table public.user_disciplines (
  user_id uuid not null references public.users (id) on delete cascade,
  discipline text not null references public.summit_tracks (name),
  created_at timestamptz not null default now(),
  primary key (user_id, discipline)
);

insert into public.user_disciplines (user_id, discipline)
select id, discipline
from public.users
where discipline is not null
on conflict do nothing;

alter table public.user_disciplines enable row level security;

create or replace function public.is_volunteer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and (role = 'volunteer' or is_volunteer)
  );
$$;

alter table public.sessions
  add column speaker text not null default '',
  add column time text not null default '',
  add column location text not null default '',
  add column track text not null default 'keynote',
  add column duration text not null default '',
  add column description text not null default '',
  add column room text not null default '',
  add column spectator_cap integer not null default 0 check (spectator_cap >= 0);

alter table public.sessions
  add constraint sessions_track_fk
  foreign key (track) references public.summit_tracks (name) on delete cascade;

alter table public.session_registrations
  add column registration_type text not null default 'competitor'
  check (registration_type in ('competitor', 'expert', 'spectator'));

drop view public.sessions_with_counts;
create view public.sessions_with_counts as
select
  s.id,
  s.title,
  s.capacity,
  s.expert_capacity,
  s.speaker,
  s.time,
  s.location,
  s.track,
  s.duration,
  s.description,
  s.room,
  s.spectator_cap,
  s.created_at,
  s.updated_at,
  count(r.user_id) filter (
    where u.role = 'participant' and r.registration_type = 'competitor'
  )::integer as enrolled,
  count(r.user_id) filter (where u.role = 'expert')::integer as experts_enrolled,
  count(r.user_id) filter (
    where u.role = 'participant' and r.registration_type = 'spectator'
  )::integer as spectators
from public.sessions s
left join public.session_registrations r on r.session_id = s.id
left join public.users u on u.id = r.user_id
group by s.id;

grant select on public.sessions_with_counts to authenticated;

create or replace function public.register_for_session(
  p_session_id uuid,
  p_registration_type text
)
returns table (
  registered boolean,
  enrolled integer,
  capacity integer,
  experts_enrolled integer,
  expert_capacity integer,
  spectators integer,
  spectator_cap integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.user_role;
  session_row public.sessions%rowtype;
  previous_type text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to register';
  end if;

  select role into current_role from public.users where id = auth.uid();
  if current_role is null then
    raise exception 'A user profile is required to register';
  end if;

  if p_registration_type not in ('competitor', 'expert', 'spectator') then
    raise exception 'Unknown registration type';
  end if;
  if (current_role = 'participant' and p_registration_type = 'expert')
    or (current_role = 'expert' and p_registration_type <> 'expert')
    or current_role not in ('participant', 'expert') then
    raise exception 'This role cannot register for that session option';
  end if;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;
  if not found then
    raise exception 'Session not found';
  end if;

  select registration_type into previous_type
  from public.session_registrations
  where session_id = p_session_id and user_id = auth.uid();

  if previous_type is distinct from p_registration_type then
    if p_registration_type = 'competitor' and (
      select count(*)
      from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id
        and u.role = 'participant'
        and r.registration_type = 'competitor'
        and r.user_id <> auth.uid()
    ) >= session_row.capacity then
      raise exception 'Session full';
    end if;
    if p_registration_type = 'expert' and (
      select count(*)
      from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id and u.role = 'expert'
        and r.user_id <> auth.uid()
    ) >= session_row.expert_capacity then
      raise exception 'Expert spots full';
    end if;
    if p_registration_type = 'spectator' and (
      select count(*)
      from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id
        and u.role = 'participant'
        and r.registration_type = 'spectator'
        and r.user_id <> auth.uid()
    ) >= session_row.spectator_cap then
      raise exception 'Spectator seats full';
    end if;

    insert into public.session_registrations (session_id, user_id, registration_type)
    values (p_session_id, auth.uid(), p_registration_type)
    on conflict (session_id, user_id)
    do update set registration_type = excluded.registration_type;
  end if;

  return query
  select
    true,
    (select count(*)::integer from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id and u.role = 'participant'
        and r.registration_type = 'competitor'),
    session_row.capacity,
    (select count(*)::integer from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id and u.role = 'expert'),
    session_row.expert_capacity,
    (select count(*)::integer from public.session_registrations r
      join public.users u on u.id = r.user_id
      where r.session_id = p_session_id and u.role = 'participant'
        and r.registration_type = 'spectator'),
    session_row.spectator_cap;
end;
$$;

revoke all on function public.register_for_session(uuid, text) from public;
grant execute on function public.register_for_session(uuid, text) to authenticated;

create policy "sessions_admin_manage"
  on public.sessions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "registrations_select_admin"
  on public.session_registrations for select to authenticated
  using (public.is_admin());

grant insert, update, delete on public.sessions to authenticated;

grant update on public.users to authenticated;

insert into public.sessions (
  title, speaker, time, location, track, duration, description, room,
  capacity, expert_capacity, spectator_cap
)
select seed.title, seed.speaker, seed.time, seed.location, seed.track,
  seed.duration, seed.description, seed.room, seed.capacity,
  seed.expert_capacity, seed.spectator_cap
from (values
  ('Opening Keynote: Innovate, Imagine, Impact', 'Marcus Chen & Elena Rodriguez', '9:00 AM', 'Main Hall A', 'keynote', '60 min', 'Summit directors open the day with a vision for what students can build, discover, and lead.', 'A', 300, 3, 0),
  ('AI & Machine Learning Foundations', 'TechVerse Faculty Lead', '11:00 AM', 'Computer Lab', 'techverse', '75 min', 'Hands-on intro to ML concepts with live demos and beginner coding exercises.', 'C', 30, 3, 10),
  ('Climate Solutions by Students', 'BioSphere Panel', '11:00 AM', 'Room 204', 'biosphere', '60 min', 'Student researchers present local environmental projects and scalable solutions.', 'D', 40, 3, 15),
  ('Visual Storytelling & Brand Design', 'ImagineX Studio Lead', '11:00 AM', 'Design Studio', 'imaginex', '90 min', 'Workshop on visual identity, layout, and communicating ideas through design.', 'E', 24, 3, 8),
  ('Rocket Science & Space Exploration', 'NovaSphere Volunteers', '1:00 PM', 'Science Wing', 'novasphere', '60 min', 'From orbital mechanics to student-built model rockets — exploring beyond Earth.', 'F', 30, 3, 12),
  ('Pitch Your Idea: Startup Studio', 'VentureVerse Coaches', '1:00 PM', 'Innovation Hub', 'ventureverse', '90 min', 'Students pitch business concepts to a panel of volunteers and receive live feedback.', 'G', 20, 3, 20),
  ('Mock Legislature & Policy Debate', 'CivicVerse Facilitators', '1:00 PM', 'Room 108', 'civicverse', '75 min', 'Simulate the legislative process by debating real policy proposals.', 'B', 35, 3, 15),
  ('Cybersecurity & Ethical Hacking', 'TechVerse Faculty Lead', '2:30 PM', 'Computer Lab', 'techverse', '60 min', 'Explore how vulnerabilities are found and patched — and the ethics behind disclosure.', 'C', 30, 3, 8),
  ('Genetics, CRISPR & Bioethics', 'BioSphere Faculty Lead', '2:30 PM', 'Bio Lab', 'biosphere', '60 min', 'Dive into gene editing technology and the moral questions scientists must navigate.', 'H', 28, 3, 10),
  ('Film & Podcast Production Lab', 'ImagineX Media Team', '2:30 PM', 'Media Lab', 'imaginex', '60 min', 'Record, edit, and produce a short segment using professional studio equipment.', 'I', 20, 3, 5),
  ('Financial Literacy & Investing 101', 'VentureVerse Coaches', '3:45 PM', 'Innovation Hub', 'ventureverse', '60 min', 'Stocks, compound interest, and personal finance — tools every student should know.', 'G', 35, 3, 20),
  ('Community Leadership & Civic Action', 'CivicVerse Panel', '3:45 PM', 'Courtyard Stage', 'civicverse', '60 min', 'Local student leaders discuss how to organize and create change in Dublin.', 'J', 60, 3, 40),
  ('Closing Ceremony & Discipline Awards', 'Marcus Chen & Elena Rodriguez', '5:00 PM', 'Main Hall A', 'keynote', '45 min', 'Celebrate standout work across all six disciplines with peer-nominated awards.', 'A', 300, 3, 0)
) as seed(title, speaker, time, location, track, duration, description, room, capacity, expert_capacity, spectator_cap)
where not exists (
  select 1 from public.sessions existing where existing.title = seed.title
);

create or replace function public.is_front_desk_volunteer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and (role = 'volunteer' or is_volunteer)
      and is_front_desk
  );
$$;

create or replace function public.volunteer_can_check_in(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users volunteer
    join public.users participant on participant.id = p_user_id
    where volunteer.id = auth.uid()
      and (volunteer.role = 'volunteer' or volunteer.is_volunteer)
      and participant.role in ('participant', 'attendee')
      and (
        volunteer.is_front_desk
        or exists (
          select 1
          from public.user_disciplines registration
          where registration.user_id = participant.id
            and registration.discipline = volunteer.discipline
        )
        or participant.discipline = volunteer.discipline
      )
  );
$$;

drop policy if exists "users_select_directory" on public.users;
create policy "users_select_directory"
  on public.users for select to authenticated
  using (
    not public.is_volunteer()
    or id = auth.uid()
    or public.is_admin()
    or public.is_front_desk_volunteer()
    or (
      role in ('participant', 'attendee')
      and public.volunteer_can_check_in(id)
    )
  );

drop policy if exists "users_update_volunteer" on public.users;
create policy "users_update_volunteer"
  on public.users for update to authenticated
  using (public.volunteer_can_check_in(id))
  with check (public.volunteer_can_check_in(id));

create policy "user_disciplines_select"
  on public.user_disciplines for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_front_desk_volunteer()
    or exists (
      select 1
      from public.users volunteer
      where volunteer.id = auth.uid()
        and (volunteer.role = 'volunteer' or volunteer.is_volunteer)
        and volunteer.discipline = user_disciplines.discipline
    )
  );

create policy "user_disciplines_insert_own"
  on public.user_disciplines for insert to authenticated
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.users
        where id = auth.uid() and role = 'participant'
      )
    )
  );

create policy "user_disciplines_delete_own"
  on public.user_disciplines for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

grant select, insert, delete on public.user_disciplines to authenticated;

create or replace function public.check_in_participant(p_user_id uuid)
returns table (
  id uuid,
  name text,
  role public.user_role,
  email text,
  checked_in_at timestamptz,
  discipline text,
  already_checked_in boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.users%rowtype;
  checkin_time timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to check in participants';
  end if;

  if not public.is_admin() and not public.volunteer_can_check_in(p_user_id) then
    if public.is_volunteer() then
      raise exception 'This person is not in your discipline.';
    end if;
    raise exception 'You do not have permission to check in this participant.';
  end if;

  select * into target
  from public.users
  where users.id = p_user_id
  for update;

  if not found then
    raise exception 'Participant not found';
  end if;

  checkin_time := coalesce(target.checked_in_at, now());

  if target.checked_in_at is null then
    update public.users
    set checked_in_at = checkin_time
    where users.id = p_user_id;
  end if;

  return query
  select target.id, target.name, target.role, target.email, checkin_time,
    target.discipline, target.checked_in_at is not null;
end;
$$;

revoke all on function public.check_in_participant(uuid) from public;
grant execute on function public.check_in_participant(uuid) to authenticated;

create or replace function public.undo_participant_check_in(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update check-in status';
  end if;
  if not public.is_admin() and not public.volunteer_can_check_in(p_user_id) then
    if public.is_volunteer() then
      raise exception 'This person is not in your discipline.';
    end if;
    raise exception 'You do not have permission to update this participant.';
  end if;

  update public.users
  set checked_in_at = null
  where id = p_user_id;
  if not found then
    raise exception 'Participant not found';
  end if;
end;
$$;

revoke all on function public.undo_participant_check_in(uuid) from public;
grant execute on function public.undo_participant_check_in(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'users'
  ) then
    alter publication supabase_realtime add table public.users;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_disciplines'
  ) then
    alter publication supabase_realtime add table public.user_disciplines;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_registrations'
  ) then
    alter publication supabase_realtime add table public.session_registrations;
  end if;
end;
$$;
