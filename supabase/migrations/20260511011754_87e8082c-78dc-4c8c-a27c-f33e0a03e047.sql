-- Harden game economy columns with non-negative CHECK constraints.
-- These prevent negative-value exploits via direct REST writes while keeping
-- all existing client update paths working unchanged.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_xp_nonneg CHECK (xp >= 0) NOT VALID,
  ADD CONSTRAINT profiles_sp_nonneg CHECK (sp >= 0) NOT VALID,
  ADD CONSTRAINT profiles_streak_nonneg CHECK (streak >= 0) NOT VALID,
  ADD CONSTRAINT profiles_focus_minutes_nonneg CHECK (focus_minutes_total >= 0) NOT VALID,
  ADD CONSTRAINT profiles_login_count_nonneg CHECK (login_count >= 0) NOT VALID;

-- Validate against existing rows (will fail loudly if any are already negative).
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_xp_nonneg;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_sp_nonneg;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_streak_nonneg;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_focus_minutes_nonneg;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_login_count_nonneg;