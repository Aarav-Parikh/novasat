
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pet_energy integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pet_last_decay_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS treats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cosmetics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipped jsonb NOT NULL DEFAULT '{}'::jsonb;
