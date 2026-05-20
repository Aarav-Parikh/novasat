-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own review" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own review" ON public.reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own review" ON public.reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins view all reviews" ON public.reviews
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profile additions: login tracking, tutorial, review prompt state
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_prompt_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Admin-visible aggregate via security definer functions
CREATE OR REPLACE FUNCTION public.admin_user_summary()
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  xp INT,
  streak INT,
  focus_minutes_total INT,
  login_count INT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.xp, p.streak, p.focus_minutes_total,
         p.login_count, p.last_login_at, p.created_at
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS TABLE(
  total_users BIGINT,
  total_focus_minutes BIGINT,
  total_xp BIGINT,
  total_sessions BIGINT,
  total_session_seconds BIGINT,
  total_reviews BIGINT,
  avg_rating NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COALESCE(SUM(focus_minutes_total),0) FROM public.profiles),
    (SELECT COALESCE(SUM(xp),0) FROM public.profiles),
    (SELECT COUNT(*) FROM public.sessions),
    (SELECT COALESCE(SUM(duration_seconds),0) FROM public.sessions),
    (SELECT COUNT(*) FROM public.reviews),
    (SELECT COALESCE(AVG(rating),0) FROM public.reviews)
  WHERE public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.admin_all_reviews()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  display_name TEXT,
  rating INT,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.user_id, p.display_name, r.rating, r.comment, r.created_at
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY r.created_at DESC
$$;