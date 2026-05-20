
-- 1) Ensure the handle_new_user trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Allow the first admin to be claimed by an authenticated user when no admin exists yet
CREATE POLICY "First admin self-claim"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role)
);

-- 3) Enable realtime on user-specific tables so the client can subscribe to changes
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.mistakes REPLICA IDENTITY FULL;
ALTER TABLE public.task_completions REPLICA IDENTITY FULL;
ALTER TABLE public.mystery_boxes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mistakes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_completions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mystery_boxes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
