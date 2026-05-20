ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sp integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_boost_until timestamp with time zone;

ALTER TABLE public.mystery_boxes
ADD COLUMN IF NOT EXISTS reward_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_mystery_boxes_user_opened ON public.mystery_boxes(user_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_task_completions_today ON public.task_completions(user_id, completed_on);