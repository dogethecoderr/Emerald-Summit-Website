alter table public.users
  drop constraint if exists users_discipline_track_fk;
alter table public.users
  add constraint users_discipline_track_fk
  foreign key (discipline)
  references public.summit_tracks (name)
  on delete set null;

alter table public.sessions
  drop constraint if exists sessions_track_fk;
alter table public.sessions
  add constraint sessions_track_fk
  foreign key (track)
  references public.summit_tracks (name)
  on delete cascade;

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index user_notifications_recipient_created_idx
  on public.user_notifications (recipient_id, created_at desc);

alter table public.user_notifications enable row level security;

create policy "user_notifications_select_own"
  on public.user_notifications for select to authenticated
  using (recipient_id = auth.uid());

grant select on public.user_notifications to authenticated;

create or replace function public.mark_user_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update notifications';
  end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid();

  if not found then
    raise exception 'Notification not found';
  end if;
end;
$$;

revoke all on function public.mark_user_notification_read(uuid) from public;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;

create or replace function public.notify_users_before_track_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_users uuid[];
  track_label text;
begin
  select label into track_label
  from public.summit_tracks
  where name = old.name;

  select array_agg(distinct affected.user_id)
  into affected_users
  from (
    select registration.user_id
    from public.user_disciplines registration
    where registration.discipline = old.name
    union
    select user_record.id
    from public.users user_record
    where user_record.discipline = old.name
    union
    select registration.user_id
    from public.sessions session_record
    join public.session_registrations registration
      on registration.session_id = session_record.id
    where session_record.track = old.name
  ) affected;

  if affected_users is not null then
    insert into public.user_notifications (recipient_id, title, body)
    select
      affected.user_id,
      'Track update: ' || coalesce(track_label, old.label),
      coalesce(track_label, old.label)
        || ' has been removed from the Summit schedule. Your track registration and any related session reservations have been canceled.'
    from unnest(affected_users) as affected(user_id);
  end if;

  delete from public.user_disciplines
  where discipline = old.name;

  return old;
end;
$$;

create trigger summit_tracks_notify_before_delete
  before delete on public.summit_tracks
  for each row
  execute function public.notify_users_before_track_delete();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end;
$$;

alter table public.user_notifications replica identity full;
