CREATE POLICY "Users can delete their own review"
ON public.reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any review"
ON public.reviews FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.baseline_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_type text NOT NULL,
  test_label text NOT NULL,
  rw_score integer NOT NULL,
  math_score integer NOT NULL,
  taken_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.baseline_scores TO authenticated;
GRANT ALL ON public.baseline_scores TO service_role;

ALTER TABLE public.baseline_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own baseline scores"
ON public.baseline_scores FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX baseline_scores_user_idx ON public.baseline_scores (user_id, taken_on DESC);