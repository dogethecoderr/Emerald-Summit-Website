-- Emerald Summit: front-desk check-in follows the Allowed Volunteers sheet.
-- Run after 20261028120000_role_allowlist.sql (it uses can_check_in_front_desk()).
--
-- Who may change another person's checked_in_at:
--   * admins (any column, as before)
--   * volunteers and ambassadors whose sheet row has can_check_in_front_desk,
--     and then ONLY checked_in_at: every other column must stay as it was
-- Nobody checks themselves in, and nobody changes their own role.
-- This replaces 20260906180000_allow_volunteer_checkin.sql's rule, which let
-- any volunteer check anyone in.

create or replace function public.enforce_users_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The sync function and other service-role writes (no signed-in user).
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Your own row: profile fields only.
  if auth.uid() = new.id then
    if new.role is distinct from old.role then
      raise exception 'Cannot change role; contact an admin';
    end if;
    if new.checked_in_at is distinct from old.checked_in_at then
      raise exception 'Cannot self check-in; see the front desk';
    end if;
    return new;
  end if;

  -- Someone else's row: front desk may change check-in status and nothing else.
  if public.can_check_in_front_desk() then
    if (to_jsonb(new) - 'checked_in_at' - 'updated_at')
       is distinct from (to_jsonb(old) - 'checked_in_at' - 'updated_at') then
      raise exception 'Front-desk volunteers can only change check-in status';
    end if;
    return new;
  end if;

  raise exception 'Permission denied: cannot update other users';
end;
$$;

drop policy if exists "users_update_volunteer" on public.users;
drop policy if exists "users_update_front_desk" on public.users;
create policy "users_update_front_desk"
  on public.users
  for update
  to authenticated
  using (public.can_check_in_front_desk() and id <> auth.uid())
  with check (public.can_check_in_front_desk() and id <> auth.uid());
