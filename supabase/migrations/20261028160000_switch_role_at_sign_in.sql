-- Emerald Summit: existing accounts can switch role at sign-in.
-- Run after 20261028140000_front_desk_check_in.sql (this replaces its
-- enforce_users_update_rules; the front-desk branch is unchanged).
--
-- The login page asks for a role. Before this, only a brand-new account got
-- it: everyone else stayed on the role they first signed up with. Now a person
-- may change their own role to:
--   * participant or attendee (open to anyone)
--   * volunteer or admin, if their sign-in email is on that Google Sheet
--   * ambassador, if they're on the Volunteers sheet as eaf_ambassador
-- Anything else (expert, or a gated role you're not listed for) is refused
-- with "You aren't eligible to sign up as that role." and nothing changes.
-- users_role_allowlist still runs afterwards and fills the volunteer columns.

create or replace function public.enforce_users_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  -- The sync function and other service-role writes (no signed-in user).
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Your own row.
  if auth.uid() = new.id then
    if new.role is distinct from old.role then
      select lower(email) into v_email from auth.users where id = new.id;
      if not (
        new.role in ('participant'::public.user_role, 'attendee'::public.user_role)
        or (new.role = 'admin'::public.user_role and exists (
              select 1 from public.role_allowlist
               where lower(email) = v_email and role = 'admin'))
        or (new.role = 'volunteer'::public.user_role and exists (
              select 1 from public.role_allowlist
               where lower(email) = v_email and role = 'volunteer'))
        or (new.role = 'ambassador'::public.user_role and exists (
              select 1 from public.role_allowlist
               where lower(email) = v_email and role = 'volunteer'
                 and subtype = 'eaf_ambassador'))
      ) then
        raise exception 'You aren''t eligible to sign up as that role.'
          using errcode = '42501';
      end if;
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
