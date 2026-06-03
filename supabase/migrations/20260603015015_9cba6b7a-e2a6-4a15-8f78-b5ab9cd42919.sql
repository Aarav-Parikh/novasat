DROP FUNCTION IF EXISTS public.admin_user_summary();
CREATE OR REPLACE FUNCTION public.admin_user_summary()
 RETURNS TABLE(user_id uuid, display_name text, email text, xp integer, streak integer, focus_minutes_total integer, login_count integer, last_login_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, u.email::text, p.xp, p.streak, p.focus_minutes_total,
         p.login_count, p.last_login_at, p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC
$function$;