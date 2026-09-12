-- Emerald Summit: admin-authored announcements with media attachments.
--
-- Reads are open to anon as well as authenticated: announcements are the
-- app's public bulletin board, and the prototype's bypass sign-in has no
-- Supabase session at all, so gating reads on `authenticated` would leave
-- most of the app looking empty. Writes stay admin-only.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.announcement_category as enum (
  'Logistics',
  'General',
  'Urgent',
  'Workshop'
);

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category public.announcement_category not null default 'General',
  audience text not null default 'Everyone',
  pinned boolean not null default false,

  -- Author is denormalised: the posting admin's display name is part of the
  -- announcement's content and must survive that admin's account being
  -- deleted, so it is stored alongside the (nullable) id reference.
  author_id uuid references public.users (id) on delete set null,
  author_name text not null,

  -- [{ id, title, type, url, path, mimeType, bytes }] — see
  -- src/models/announcements.ts for the shape this mirrors.
  attachments jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcements_title_not_empty check (char_length(trim(title)) > 0),
  constraint announcements_body_not_empty check (char_length(trim(body)) > 0),
  constraint announcements_attachments_array
    check (jsonb_typeof(attachments) = 'array')
);

comment on table public.announcements is
  'Admin-authored announcements shown to every role on the dashboard and Announcements tab.';

comment on column public.announcements.attachments is
  'Ordered media/link attachments; files live in the announcement-media storage bucket.';

-- Pinned first, then newest — the exact order the UI renders.
create index announcements_feed_idx
  on public.announcements (pinned desc, created_at desc);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.announcements enable row level security;

create policy "announcements_select_all"
  on public.announcements
  for select
  to anon, authenticated
  using (true);

create policy "announcements_insert_admin"
  on public.announcements
  for insert
  to authenticated
  with check (public.is_admin());

create policy "announcements_update_admin"
  on public.announcements
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "announcements_delete_admin"
  on public.announcements
  for delete
  to authenticated
  using (public.is_admin());

grant select on table public.announcements to anon, authenticated, service_role;
grant insert, update, delete on table public.announcements to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- This is what makes an admin's post appear on every other signed-in profile
-- without a refresh; the client subscribes in src/services/announcements.ts.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.announcements;

-- Realtime delivers old-record data on UPDATE/DELETE only when the table has
-- a full replica identity.
alter table public.announcements replica identity full;

-- ---------------------------------------------------------------------------
-- Storage: announcement media
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('announcement-media', 'announcement-media', true, 104857600)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

create policy "announcement_media_read_all"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'announcement-media');

create policy "announcement_media_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'announcement-media' and public.is_admin());

create policy "announcement_media_update_admin"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'announcement-media' and public.is_admin())
  with check (bucket_id = 'announcement-media' and public.is_admin());

create policy "announcement_media_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'announcement-media' and public.is_admin());
