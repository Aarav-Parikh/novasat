
-- 1. Harden bump_ai_usage: require caller == _user_id, clamp amount
CREATE OR REPLACE FUNCTION public.bump_ai_usage(_user_id uuid, _amount integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, integer) TO authenticated;

-- 2. Remove the first-admin self-claim policy (privilege escalation risk)
DROP POLICY IF EXISTS "First admin self-claim" ON public.user_roles;

-- 3. Restrict admin RPCs to authenticated only (RLS inside still checks admin role)
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_summary() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_all_reviews() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 4. Realtime: scope subscriptions to the authenticated user's own topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own topic" ON realtime.messages;
CREATE POLICY "Users subscribe to own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'nova-sync:' || auth.uid()::text
);
