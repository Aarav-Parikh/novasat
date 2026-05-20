-- Ensure unique constraint for upsert on task_completions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_completions_user_task_day_unique'
  ) THEN
    ALTER TABLE public.task_completions
      ADD CONSTRAINT task_completions_user_task_day_unique
      UNIQUE (user_id, task_key, completed_on);
  END IF;
END $$;