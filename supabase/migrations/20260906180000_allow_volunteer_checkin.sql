-- Migration: 20260906180000_allow_volunteer_checkin.sql
-- Allow volunteers to update checked_in_at on other users while protecting sensitive fields

-- 1. Helper function: is_volunteer()
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
      and role = 'volunteer'
  );
$$;

comment on function public.is_volunteer() is
  'Returns true when the authenticated user has the volunteer role.';

-- 2. Update enforce_users_update_rules trigger function
create or replace function public.enforce_users_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- System/service_role operations (auth.uid() is null) bypass restrictions
  if auth.uid() is null then
    return new;
  end if;

  -- Admins can update any field on any user
  if public.is_admin() then
    return new;
  end if;

  -- Self-update restrictions (updating own profile)
  if auth.uid() = new.id then
    if new.role = 'admin'::public.user_role then
      raise exception 'Cannot self-assign admin role';
    end if;

    if new.role is distinct from old.role then
      raise exception 'Cannot change role; contact an admin';
    end if;

    if new.checked_in_at is distinct from old.checked_in_at then
      raise exception 'Cannot self check-in; see an admin at the front desk';
    end if;

    return new;
  end if;

  -- Other-user update restrictions (updating another user's record)
  if public.is_volunteer() then
    -- Volunteers are ONLY permitted to update checked_in_at (and updated_at handled by system trigger)
    if new.id is distinct from old.id or
       new.name is distinct from old.name or
       new.role is distinct from old.role or
       new.email is distinct from old.email or
       new.phone is distinct from old.phone or
       new.discipline is distinct from old.discipline or
       new.bio is distinct from old.bio or
       new.profile_setup_complete is distinct from old.profile_setup_complete or
       new.created_at is distinct from old.created_at then
      raise exception 'Volunteers are only permitted to update checked_in_at';
    end if;

    return new;
  end if;

  -- All other users are blocked from updating other records
  raise exception 'Permission denied: cannot update other users';
end;
$$;

-- 3. Row-Level Security Policy for Volunteers
drop policy if exists "users_update_volunteer" on public.users;

create policy "users_update_volunteer"
  on public.users
  for update
  to authenticated
  using (public.is_volunteer() and id != auth.uid())
  with check (public.is_volunteer() and id != auth.uid());
