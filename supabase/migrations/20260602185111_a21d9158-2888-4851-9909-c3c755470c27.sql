
-- Fix claim_daily_sp: variable name shadowed the column, so EXISTS check always matched
CREATE OR REPLACE FUNCTION public.claim_daily_sp()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  today_d date := (now() AT TIME ZONE 'UTC')::date;
  v_task_key text := 'daily-sp::' || today_d::text;
  amount int := 25;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.task_completions tc
    WHERE tc.user_id = uid AND tc.task_key = v_task_key AND tc.completed_on = today_d
  ) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_claimed');
  END IF;

  INSERT INTO public.task_completions (user_id, task_key, task_label, day_label, completed_on)
  VALUES (uid, v_task_key, 'Daily SP bonus', 'Today', today_d)
  RETURNING id INTO new_id;

  UPDATE public.profiles SET sp = sp + amount WHERE id = uid;

  RETURN jsonb_build_object('claimed', true, 'amount', amount, 'task_id', new_id);
END;
$function$;

-- Wake-up pet now ADDS percentage to current decayed energy (capped at 100)
CREATE OR REPLACE FUNCTION public.wake_up_pet(_score integer, _total integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  safe_score int;
  safe_total int;
  pct numeric;
  current_energy numeric;
  new_energy int;
  decay_per_ms numeric := 25.0 / (24*60*60*1000);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  safe_total := GREATEST(1, LEAST(COALESCE(_total, 1), 100));
  safe_score := GREATEST(0, LEAST(COALESCE(_score, 0), safe_total));
  pct := (safe_score::numeric / safe_total::numeric) * 100.0;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;

  current_energy := GREATEST(0, LEAST(100,
    prof.pet_energy - EXTRACT(EPOCH FROM (now() - prof.pet_last_decay_at)) * 1000 * decay_per_ms
  ));
  new_energy := GREATEST(0, LEAST(100, ROUND(current_energy + pct)::int));

  UPDATE public.profiles
  SET pet_energy = new_energy,
      pet_last_decay_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('pet_energy', new_energy, 'added_pct', ROUND(pct));
END;
$function$;

-- Grant admin role to aaravkp30@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE u.email = 'aaravkp30@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
