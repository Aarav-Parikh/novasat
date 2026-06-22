
-- Adaptive pacing settings + counter
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adaptive_pacing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS full_sat_pacing_uses integer NOT NULL DEFAULT 0;

GRANT UPDATE (adaptive_pacing_enabled) ON public.profiles TO authenticated;

-- RPC to bump pacing counter (server-authoritative)
CREATE OR REPLACE FUNCTION public.increment_pacing_uses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles
    SET full_sat_pacing_uses = COALESCE(full_sat_pacing_uses,0) + 1
    WHERE id = uid
    RETURNING full_sat_pacing_uses INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Per-question annotations (flag categories + eliminator tags)
CREATE TABLE IF NOT EXISTS public.question_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_prompt text,
  topic text,
  section text,
  flag_category text,
  flag_note text,
  eliminations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_annotations TO authenticated;
GRANT ALL ON public.question_annotations TO service_role;

ALTER TABLE public.question_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_annotations_select" ON public.question_annotations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_annotations_insert" ON public.question_annotations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_annotations_update" ON public.question_annotations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_annotations_delete" ON public.question_annotations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_question_annotations_user_session
  ON public.question_annotations (user_id, session_id);

CREATE TRIGGER trg_touch_question_annotations
  BEFORE UPDATE ON public.question_annotations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
