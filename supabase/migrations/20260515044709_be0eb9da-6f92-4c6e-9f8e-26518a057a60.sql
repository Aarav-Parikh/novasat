REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM authenticated, anon, public;