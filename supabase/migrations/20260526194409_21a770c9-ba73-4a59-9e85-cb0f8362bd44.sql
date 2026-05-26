
CREATE OR REPLACE FUNCTION public.wake_up_pet(_score integer, _total integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  safe_score int;
  safe_total int;
  pct numeric;
  new_energy int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  safe_total := GREATEST(1, LEAST(COALESCE(_total, 1), 100));
  safe_score := GREATEST(0, LEAST(COALESCE(_score, 0), safe_total));
  pct := (safe_score::numeric / safe_total::numeric) * 100.0;
  new_energy := GREATEST(0, LEAST(100, ROUND(pct)::int));

  UPDATE public.profiles
  SET pet_energy = new_energy,
      pet_last_decay_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('pet_energy', new_energy);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.wake_up_pet(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wake_up_pet(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_cosmetic(_cosmetic_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  catalog jsonb := jsonb_build_object(
    -- hats
    'grad_cap',    120,
    'beanie',       60,
    'wizard_hat',  180,
    'crown',       300,
    'cowboy_hat',  140,
    'party_hat',    80,
    'top_hat',     200,
    -- neck
    'scarf',        90,
    'bowtie',       50,
    'medal',       200,
    'bandana',      70,
    'necktie',     110,
    'gold_chain',  260,
    -- outfit
    'uniform',     250,
    'hoodie',      150,
    'labcoat',     220,
    'superhero_cape', 280,
    'tuxedo',      320,
    'varsity_jacket', 200,
    'pajamas',     130
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
$function$;
