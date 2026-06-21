
CREATE OR REPLACE FUNCTION public.record_login_and_get_onboarding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  has_review boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.profiles
  SET login_count = COALESCE(login_count, 0) + 1,
      last_login_at = now()
  WHERE id = uid
  RETURNING * INTO prof;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.reviews WHERE user_id = uid) INTO has_review;

  RETURN jsonb_build_object(
    'ok', true,
    'login_count', prof.login_count,
    'tutorial_completed', prof.tutorial_completed,
    'review_prompt_dismissed', prof.review_prompt_dismissed,
    'has_review', has_review
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_tutorial_completed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET tutorial_completed = true WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_review_prompt_dismissed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET review_prompt_dismissed = true WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login_and_get_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_tutorial_completed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_review_prompt_dismissed() TO authenticated;
