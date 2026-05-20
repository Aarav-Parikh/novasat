CREATE OR REPLACE FUNCTION public.bump_ai_usage(_user_id uuid, _amount integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  new_count INTEGER;
  safe_amount INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  safe_amount := GREATEST(1, LEAST(COALESCE(_amount, 1), 10));

  INSERT INTO public.ai_usage (user_id, used_on, count)
  VALUES (_user_id, CURRENT_DATE, safe_amount)
  ON CONFLICT (user_id, used_on)
  DO UPDATE SET count = ai_usage.count + safe_amount, updated_at = now()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_all_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated;