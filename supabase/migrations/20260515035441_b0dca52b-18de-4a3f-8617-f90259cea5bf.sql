
-- 1. Explicit deny for non-admins on user_roles writes
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Revoke EXECUTE from anon on admin-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_all_reviews() TO authenticated;

-- 3. Revoke anon execute on user-scoped definer functions (still callable by authenticated users)
REVOKE EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 4. Internal trigger functions: should not be exposed via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, public, authenticated;
