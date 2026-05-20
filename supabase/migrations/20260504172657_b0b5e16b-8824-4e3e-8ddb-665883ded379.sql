-- Track daily AI question-generation usage per user
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL,
  used_on DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, used_on)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own ai_usage" ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own ai_usage" ON public.ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own ai_usage" ON public.ai_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- RPC: atomically increment today's count, return new value
CREATE OR REPLACE FUNCTION public.bump_ai_usage(_user_id UUID, _amount INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, used_on, count)
  VALUES (_user_id, CURRENT_DATE, _amount)
  ON CONFLICT (user_id, used_on)
  DO UPDATE SET count = ai_usage.count + EXCLUDED.count, updated_at = now()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;