
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_all_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated;
