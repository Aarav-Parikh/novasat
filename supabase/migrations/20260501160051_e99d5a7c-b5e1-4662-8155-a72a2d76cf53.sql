REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_all_reviews() TO authenticated;