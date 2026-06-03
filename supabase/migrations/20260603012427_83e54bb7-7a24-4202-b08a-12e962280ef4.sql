
CREATE OR REPLACE FUNCTION public.record_session_rewards(_mode text, _score integer, _total integer, _duration integer, _xp integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Buff catalog: each cosmetic id maps to { xp_pct, sp_pct, treats_flat }
  buffs jsonb := jsonb_build_object(
    -- hats
    'grad_cap',       jsonb_build_object('xp_pct', 0.10, 'sp_pct', 0,    'treats_flat', 0),
    'beanie',         jsonb_build_object('xp_pct', 0.05, 'sp_pct', 0,    'treats_flat', 0),
    'wizard_hat',     jsonb_build_object('xp_pct', 0.15, 'sp_pct', 0,    'treats_flat', 0),
    'crown',          jsonb_build_object('xp_pct', 0,    'sp_pct', 0.20, 'treats_flat', 0),
    'cowboy_hat',     jsonb_build_object('xp_pct', 0,    'sp_pct', 0,    'treats_flat', 1),
    'party_hat',      jsonb_build_object('xp_pct', 0,    'sp_pct', 0.10, 'treats_flat', 0),
    'top_hat',        jsonb_build_object('xp_pct', 0,    'sp_pct', 0.10, 'treats_flat', 0),
    -- neck
    'scarf',          jsonb_build_object('xp_pct', 0.05, 'sp_pct', 0,    'treats_flat', 0),
    'bowtie',         jsonb_build_object('xp_pct', 0,    'sp_pct', 0.05, 'treats_flat', 0),
    'medal',          jsonb_build_object('xp_pct', 0,    'sp_pct', 0.15, 'treats_flat', 0),
    'bandana',        jsonb_build_object('xp_pct', 0.05, 'sp_pct', 0,    'treats_flat', 0),
    'necktie',        jsonb_build_object('xp_pct', 0.10, 'sp_pct', 0,    'treats_flat', 0),
    'gold_chain',     jsonb_build_object('xp_pct', 0,    'sp_pct', 0.20, 'treats_flat', 0),
    -- outfit
    'uniform',        jsonb_build_object('xp_pct', 0.15, 'sp_pct', 0,    'treats_flat', 0),
    'hoodie',         jsonb_build_object('xp_pct', 0.10, 'sp_pct', 0.05, 'treats_flat', 0),
    'labcoat',        jsonb_build_object('xp_pct', 0.20, 'sp_pct', 0,    'treats_flat', 0),
    'superhero_cape', jsonb_build_object('xp_pct', 0.25, 'sp_pct', 0,    'treats_flat', 0),
    'tuxedo',         jsonb_build_object('xp_pct', 0,    'sp_pct', 0.25, 'treats_flat', 0),
    'varsity_jacket', jsonb_build_object('xp_pct', 0.15, 'sp_pct', 0.10, 'treats_flat', 0),
    'pajamas',        jsonb_build_object('xp_pct', 0,    'sp_pct', 0,    'treats_flat', 2)
  );
  equipped_ids text[];
  xp_bonus_pct numeric := 0;
  sp_bonus_pct numeric := 0;
  treats_bonus int := 0;
  cid text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _mode NOT IN ('drill','test','review') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  safe_total    := GREATEST(0, LEAST(COALESCE(_total,0), 200));
  safe_score    := GREATEST(0, LEAST(COALESCE(_score,0), safe_total));
  safe_duration := GREATEST(0, LEAST(COALESCE(_duration,0), 60*60*6));
  safe_xp       := GREATEST(0, LEAST(COALESCE(_xp,0), safe_score * 25));

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;

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

  current_energy := GREATEST(0, LEAST(100,
    prof.pet_energy - EXTRACT(EPOCH FROM (now() - prof.pet_last_decay_at)) * 1000 * decay_per_ms
  ));
  mood := CASE
    WHEN current_energy >= 75 THEN 'energetic'
    WHEN current_energy >= 25 THEN 'tired'
    ELSE 'asleep'
  END;
  sp_mult := CASE WHEN mood = 'energetic' THEN 1.2 ELSE 1.0 END;

  -- Sum up buffs from equipped cosmetics
  equipped_ids := ARRAY[
    NULLIF(prof.equipped->>'hat', ''),
    NULLIF(prof.equipped->>'neck', ''),
    NULLIF(prof.equipped->>'outfit', '')
  ];
  FOREACH cid IN ARRAY equipped_ids LOOP
    IF cid IS NOT NULL AND (buffs ? cid) THEN
      xp_bonus_pct := xp_bonus_pct + COALESCE((buffs->cid->>'xp_pct')::numeric, 0);
      sp_bonus_pct := sp_bonus_pct + COALESCE((buffs->cid->>'sp_pct')::numeric, 0);
      treats_bonus := treats_bonus + COALESCE((buffs->cid->>'treats_flat')::int, 0);
    END IF;
  END LOOP;

  safe_xp    := ROUND(safe_xp * (1 + xp_bonus_pct))::int;
  sp_awarded := ROUND(5 * sp_mult * (1 + sp_bonus_pct))::int;

  treats_awarded := CASE WHEN _mode = 'review' THEN 0 ELSE FLOOR(safe_score / 5.0) END;
  IF _mode <> 'review' AND safe_score > 0 THEN
    treats_awarded := treats_awarded + treats_bonus;
  END IF;

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
    'streak', next_streak,
    'xp_bonus_pct', xp_bonus_pct,
    'sp_bonus_pct', sp_bonus_pct,
    'treats_bonus', treats_bonus
  );
END;
$function$;
