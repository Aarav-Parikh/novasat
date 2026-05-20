DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'box_tier' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.box_tier AS ENUM ('common', 'rare', 'epic', 'legendary');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  task_label TEXT NOT NULL,
  day_label TEXT NOT NULL,
  completed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_key, completed_on)
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own task completions" ON public.task_completions;
CREATE POLICY "Users can view their own task completions"
ON public.task_completions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own task completions" ON public.task_completions;
CREATE POLICY "Users can create their own task completions"
ON public.task_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own task completions" ON public.task_completions;
CREATE POLICY "Users can update their own task completions"
ON public.task_completions
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own task completions" ON public.task_completions;
CREATE POLICY "Users can delete their own task completions"
ON public.task_completions
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_completions_user_day
ON public.task_completions (user_id, completed_on DESC);

CREATE TABLE IF NOT EXISTS public.mystery_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  tier public.box_tier NOT NULL DEFAULT 'common',
  upgrade_clicks_used INTEGER NOT NULL DEFAULT 0,
  reward_label TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT mystery_boxes_level_number_check CHECK (level_number > 0),
  CONSTRAINT mystery_boxes_upgrade_clicks_used_check CHECK (upgrade_clicks_used BETWEEN 0 AND 3),
  UNIQUE (user_id, level_number)
);

ALTER TABLE public.mystery_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mystery boxes" ON public.mystery_boxes;
CREATE POLICY "Users can view their own mystery boxes"
ON public.mystery_boxes
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own mystery boxes" ON public.mystery_boxes;
CREATE POLICY "Users can create their own mystery boxes"
ON public.mystery_boxes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own mystery boxes" ON public.mystery_boxes;
CREATE POLICY "Users can update their own mystery boxes"
ON public.mystery_boxes
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own mystery boxes" ON public.mystery_boxes;
CREATE POLICY "Users can delete their own mystery boxes"
ON public.mystery_boxes
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mystery_boxes_user_level
ON public.mystery_boxes (user_id, level_number DESC);

DROP TRIGGER IF EXISTS touch_mystery_boxes_updated_at ON public.mystery_boxes;
CREATE TRIGGER touch_mystery_boxes_updated_at
BEFORE UPDATE ON public.mystery_boxes
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();