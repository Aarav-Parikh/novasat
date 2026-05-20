REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_all_reviews() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO service_role;