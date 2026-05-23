
-- handle_new_user is only invoked by the auth trigger, never by API users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies; policies run as SECURITY DEFINER context
-- so only revoke direct API execution from anon (signed-in users still need it
-- so policies referencing it via the PostgREST path keep working).
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
