DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own review" ON public.reviews;
CREATE POLICY "Only owner account can delete reviews" ON public.reviews
FOR DELETE TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'aaravkp30@gmail.com');

CREATE OR REPLACE FUNCTION public.sync_streak()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); last_date date; cur int;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  SELECT MAX(created_at)::date INTO last_date FROM public.sessions WHERE user_id = uid;
  SELECT streak INTO cur FROM public.profiles WHERE id = uid;
  IF last_date IS NULL OR ((now() AT TIME ZONE 'UTC')::date - last_date) > 1 THEN
    UPDATE public.profiles SET streak = 0 WHERE id = uid AND streak <> 0;
    RETURN 0;
  END IF;
  RETURN COALESCE(cur, 0);
END $$;
REVOKE ALL ON FUNCTION public.sync_streak() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_streak() TO authenticated;

UPDATE public.profiles SET sp = 1000000
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = 'aaravkp30@gmail.com');