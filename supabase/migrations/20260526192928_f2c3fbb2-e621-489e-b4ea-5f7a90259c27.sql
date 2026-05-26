
-- =========================================================
-- Economy RPCs (SECURITY DEFINER, validate everything server-side)
-- =========================================================

-- 1) Record session rewards: computes SP/treats/streak server-side, applies capped XP.
CREATE OR REPLACE FUNCTION public.record_session_rewards(
  _mode text,
  _score integer,
  _total integer,
  _duration integer,
  _xp integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  last_date date;
  today_d date := (now() AT TIME ZONE 'UTC')::date;
  diff_days int;
  next_streak int;
  current_energy numeric;
  decay_per_ms numeric := 25.0 / (24*60*60*1000);
  mood text;
  sp_mult numeric;
  sp_awarded int;
  treats_awarded int;
  safe_xp int;
  safe_score int;
  safe_total int;
  safe_duration int;
  new_session_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _mode NOT IN ('drill','test','review') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  safe_total    := GREATEST(0, LEAST(COALESCE(_total,0), 200));
  safe_score    := GREATEST(0, LEAST(COALESCE(_score,0), safe_total));
  safe_duration := GREATEST(0, LEAST(COALESCE(_duration,0), 60*60*6));
  -- XP capped at 10 per question (max difficulty value).
  safe_xp       := GREATEST(0, LEAST(COALESCE(_xp,0), safe_total * 10));

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;

  -- Streak based on prior session date
  SELECT MAX(created_at)::date INTO last_date FROM public.sessions WHERE user_id = uid;
  next_streak := COALESCE(prof.streak, 0);
  IF last_date IS NULL THEN
    next_streak := 1;
  ELSIF last_date = today_d THEN
    next_streak := GREATEST(1, next_streak);
  ELSE
    diff_days := today_d - last_date;
    next_streak := CASE WHEN diff_days = 1 THEN next_streak + 1 ELSE 1 END;
  END IF;

  -- Pet mood -> SP multiplier
  current_energy := GREATEST(0, LEAST(100,
    prof.pet_energy - EXTRACT(EPOCH FROM (now() - prof.pet_last_decay_at)) * 1000 * decay_per_ms
  ));
  mood := CASE
    WHEN current_energy >= 75 THEN 'energetic'
    WHEN current_energy >= 25 THEN 'tired'
    ELSE 'asleep'
  END;
  sp_mult := CASE WHEN mood = 'energetic' THEN 1.2 ELSE 1.0 END;
  sp_awarded := ROUND(5 * sp_mult);

  treats_awarded := CASE WHEN _mode = 'review' THEN 0 ELSE FLOOR(safe_score / 5.0) END;

  INSERT INTO public.sessions (user_id, mode, score, total, duration_seconds, xp_earned)
  VALUES (uid, _mode, safe_score, safe_total, safe_duration, safe_xp)
  RETURNING id INTO new_session_id;

  UPDATE public.profiles
  SET streak = next_streak,
      xp     = xp     + safe_xp,
      sp     = sp     + sp_awarded,
      treats = treats + treats_awarded
  WHERE id = uid;

  RETURN jsonb_build_object(
    'session_id', new_session_id,
    'xp_awarded', safe_xp,
    'sp_awarded', sp_awarded,
    'treats_awarded', treats_awarded,
    'streak', next_streak
  );
END;
$$;

-- 2) Claim daily SP (server-controlled amount, once per UTC day)
CREATE OR REPLACE FUNCTION public.claim_daily_sp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today_d date := (now() AT TIME ZONE 'UTC')::date;
  task_key text := 'daily-sp::' || today_d::text;
  amount int := 25;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.task_completions
    WHERE user_id = uid AND task_key = task_key AND completed_on = today_d
  ) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_claimed');
  END IF;

  INSERT INTO public.task_completions (user_id, task_key, task_label, day_label, completed_on)
  VALUES (uid, task_key, 'Daily SP bonus', 'Today', today_d)
  RETURNING id INTO new_id;

  UPDATE public.profiles SET sp = sp + amount WHERE id = uid;

  RETURN jsonb_build_object('claimed', true, 'amount', amount, 'task_id', new_id);
END;
$$;

-- 3) Feed pet (deducts treats, raises energy)
CREATE OR REPLACE FUNCTION public.feed_pet(_treats integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  n int;
  current_energy numeric;
  next_energy numeric;
  decay_per_ms numeric := 25.0 / (24*60*60*1000);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  n := GREATEST(1, LEAST(COALESCE(_treats,1), 100));

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF prof.treats < n THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_treats'); END IF;

  current_energy := GREATEST(0, LEAST(100,
    prof.pet_energy - EXTRACT(EPOCH FROM (now() - prof.pet_last_decay_at)) * 1000 * decay_per_ms
  ));
  next_energy := LEAST(100, current_energy + n * 5);

  UPDATE public.profiles
  SET treats = treats - n,
      pet_energy = ROUND(next_energy),
      pet_last_decay_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'pet_energy', ROUND(next_energy));
END;
$$;

-- 4) Buy cosmetic (server-side catalog with fixed prices)
CREATE OR REPLACE FUNCTION public.buy_cosmetic(_cosmetic_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  catalog jsonb := jsonb_build_object(
    'grad_cap',   120,
    'beanie',      60,
    'wizard_hat', 180,
    'scarf',       90,
    'bowtie',      50,
    'medal',      200,
    'uniform',    250,
    'hoodie',     150,
    'labcoat',    220
  );
  cost int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT (catalog ? _cosmetic_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_cosmetic');
  END IF;
  cost := (catalog ->> _cosmetic_id)::int;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF prof.cosmetics ? _cosmetic_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
  END IF;
  IF prof.sp < cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_sp');
  END IF;

  UPDATE public.profiles
  SET sp = sp - cost,
      cosmetics = cosmetics || to_jsonb(_cosmetic_id)
  WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'cost', cost);
END;
$$;

-- 5) Equip cosmetic (validates ownership; null/empty unequips)
CREATE OR REPLACE FUNCTION public.equip_cosmetic(_slot text, _cosmetic_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  next_equipped jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _slot NOT IN ('hat','neck','outfit') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot');
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;

  next_equipped := COALESCE(prof.equipped, '{}'::jsonb);

  IF _cosmetic_id IS NULL OR _cosmetic_id = '' THEN
    next_equipped := next_equipped - _slot;
  ELSE
    IF NOT (prof.cosmetics ? _cosmetic_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
    END IF;
    next_equipped := next_equipped || jsonb_build_object(_slot, _cosmetic_id);
  END IF;

  UPDATE public.profiles SET equipped = next_equipped WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'equipped', next_equipped);
END;
$$;

-- 6) Sync pet decay (server computes the decayed value)
CREATE OR REPLACE FUNCTION public.sync_pet_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  current_energy numeric;
  decay_per_ms numeric := 25.0 / (24*60*60*1000);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;

  current_energy := GREATEST(0, LEAST(100,
    prof.pet_energy - EXTRACT(EPOCH FROM (now() - prof.pet_last_decay_at)) * 1000 * decay_per_ms
  ));

  UPDATE public.profiles
  SET pet_energy = ROUND(current_energy),
      pet_last_decay_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('pet_energy', ROUND(current_energy));
END;
$$;

-- Permissions: anon cannot call any of these; authenticated can.
REVOKE EXECUTE ON FUNCTION public.record_session_rewards(text,int,int,int,int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_daily_sp()                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.feed_pet(int)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buy_cosmetic(text)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equip_cosmetic(text,text)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_pet_decay()                              FROM PUBLIC, anon;

GRANT  EXECUTE ON FUNCTION public.record_session_rewards(text,int,int,int,int) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_daily_sp()                              TO authenticated;
GRANT  EXECUTE ON FUNCTION public.feed_pet(int)                                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.buy_cosmetic(text)                            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.equip_cosmetic(text,text)                     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.sync_pet_decay()                              TO authenticated;

-- =========================================================
-- Lock down economy columns on profiles: only RPCs (SECURITY DEFINER, owner)
-- and service_role/admins can modify them. Non-economy profile columns
-- (display_name, target_score, test_date, tutorial_completed,
-- review_prompt_dismissed, inventory) remain user-updatable.
-- =========================================================

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (
  display_name,
  target_score,
  test_date,
  tutorial_completed,
  review_prompt_dismissed,
  inventory
) ON public.profiles TO authenticated;
