
-- 1. Account type on profiles
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('student', 'parent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'student';

-- Update handle_new_user to also copy account_type from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  meta_type text;
  final_type public.account_type;
begin
  meta_type := new.raw_user_meta_data->>'account_type';
  final_type := CASE WHEN meta_type = 'parent' THEN 'parent'::public.account_type ELSE 'student'::public.account_type END;

  insert into public.profiles (id, display_name, account_type)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    final_type
  )
  on conflict (id) do update
  set display_name = coalesce(public.profiles.display_name, excluded.display_name);

  if final_type = 'student' then
    insert into public.mystery_boxes (user_id, level_number, tier, reward_label)
    values (new.id, 0, 'rare', 'Starter Box')
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

-- 2. Unique username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_lower_uniq
  ON public.profiles (lower(display_name)) WHERE display_name IS NOT NULL;

-- 3. Parent links
CREATE TABLE IF NOT EXISTS public.parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_links TO authenticated;
GRANT ALL ON public.parent_links TO service_role;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents and students see own links" ON public.parent_links
  FOR SELECT USING (auth.uid() = parent_id OR auth.uid() = student_id);

-- 4. Quest claims (daily/weekly SP)
CREATE TABLE IF NOT EXISTS public.quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_key text NOT NULL,
  period_key text NOT NULL, -- e.g. '2026-07-11' for daily, '2026-W28' for weekly
  reward_sp int NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_key, period_key)
);

GRANT SELECT, INSERT ON public.quest_claims TO authenticated;
GRANT ALL ON public.quest_claims TO service_role;
ALTER TABLE public.quest_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own quest claims" ON public.quest_claims
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Send friend request by email
CREATE OR REPLACE FUNCTION public.send_friend_request_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); target uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF target = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE (user_id=uid AND friend_id=target) OR (user_id=target AND friend_id=uid)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exists');
  END IF;
  INSERT INTO public.friendships (user_id, friend_id, status) VALUES (uid, target, 'pending');
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. Suggested users (random students not self/not linked)
CREATE OR REPLACE FUNCTION public.suggested_users(_limit int DEFAULT 8)
RETURNS TABLE(user_id uuid, display_name text, xp int, streak int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.display_name, p.xp, p.streak
  FROM public.profiles p
  WHERE p.account_type = 'student'
    AND p.id <> auth.uid()
    AND p.display_name IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.user_id = auth.uid() AND f.friend_id = p.id)
         OR (f.user_id = p.id AND f.friend_id = auth.uid())
    )
  ORDER BY random()
  LIMIT LEAST(GREATEST(_limit,1), 25)
$$;

-- 7. Parent link RPCs
CREATE OR REPLACE FUNCTION public.request_parent_link(_child_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); target uuid; my_type public.account_type;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT account_type INTO my_type FROM public.profiles WHERE id = uid;
  IF my_type <> 'parent' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_parent'); END IF;

  SELECT u.id INTO target FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE lower(u.email) = lower(trim(_child_email)) AND p.account_type = 'student' LIMIT 1;
  IF target IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'child_not_found'); END IF;

  INSERT INTO public.parent_links (parent_id, student_id, status)
    VALUES (uid, target, 'pending')
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_parent_link(_id uuid, _accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _accept THEN
    UPDATE public.parent_links SET status='accepted' WHERE id=_id AND student_id=uid AND status='pending';
  ELSE
    DELETE FROM public.parent_links WHERE id=_id AND student_id=uid;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_parent_links()
RETURNS TABLE(id uuid, parent_id uuid, student_id uuid, status text, parent_name text, student_name text, student_email text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l.id, l.parent_id, l.student_id, l.status,
    pp.display_name, sp.display_name, su.email::text, l.created_at
  FROM public.parent_links l
  LEFT JOIN public.profiles pp ON pp.id = l.parent_id
  LEFT JOIN public.profiles sp ON sp.id = l.student_id
  LEFT JOIN auth.users su ON su.id = l.student_id
  WHERE l.parent_id = auth.uid() OR l.student_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.parent_child_progress(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p public.profiles%ROWTYPE;
  weekly_xp bigint; total_seconds bigint; total_answered bigint; total_correct bigint;
  top_topics jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.parent_links WHERE parent_id=auth.uid() AND student_id=_student_id AND status='accepted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;
  SELECT * INTO p FROM public.profiles WHERE id = _student_id;
  SELECT COALESCE(SUM(xp_earned),0), COALESCE(SUM(duration_seconds),0),
         COALESCE(SUM(total),0), COALESCE(SUM(score),0)
    INTO weekly_xp, total_seconds, total_answered, total_correct
    FROM public.sessions WHERE user_id = _student_id AND created_at > now() - interval '7 days';
  SELECT jsonb_agg(t) INTO top_topics FROM (
    SELECT topic, COUNT(*) AS misses FROM public.mistakes WHERE user_id = _student_id AND topic IS NOT NULL
    GROUP BY topic ORDER BY 2 DESC LIMIT 5
  ) t;
  RETURN jsonb_build_object(
    'ok', true,
    'display_name', p.display_name,
    'target_score', p.target_score,
    'test_date', p.test_date,
    'xp', p.xp,
    'streak', p.streak,
    'weekly_xp', weekly_xp,
    'hours_logged', ROUND(total_seconds/3600.0, 1),
    'accuracy', CASE WHEN total_answered>0 THEN ROUND(100.0*total_correct/total_answered) ELSE 0 END,
    'top_weak_topics', COALESCE(top_topics, '[]'::jsonb)
  );
END;
$$;

-- 8. Quests: list + claim
CREATE OR REPLACE FUNCTION public.list_quests()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  today_d date := (now() AT TIME ZONE 'UTC')::date;
  week_key text := to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
  day_key text := today_d::text;
  -- daily metrics
  d_answered int;
  d_seconds int;
  d_sessions int;
  -- weekly metrics
  w_answered int;
  w_seconds int;
  w_sessions int;
  w_xp int;
  prof public.profiles%ROWTYPE;
  claimed jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = uid;

  SELECT COALESCE(SUM(total),0), COALESCE(SUM(duration_seconds),0), COUNT(*)
    INTO d_answered, d_seconds, d_sessions
    FROM public.sessions
    WHERE user_id=uid AND (created_at AT TIME ZONE 'UTC')::date = today_d;

  SELECT COALESCE(SUM(total),0), COALESCE(SUM(duration_seconds),0), COUNT(*), COALESCE(SUM(xp_earned),0)
    INTO w_answered, w_seconds, w_sessions, w_xp
    FROM public.sessions
    WHERE user_id=uid AND created_at > now() - interval '7 days';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('quest_key', quest_key, 'period_key', period_key)), '[]'::jsonb)
    INTO claimed
    FROM public.quest_claims
    WHERE user_id=uid AND period_key IN (day_key, week_key);

  RETURN jsonb_build_object(
    'day_key', day_key,
    'week_key', week_key,
    'daily', jsonb_build_array(
      jsonb_build_object('key','daily_login','label','Daily login bonus','desc','Just show up today.','goal',1,'progress',1,'reward_sp',25,'kind','daily'),
      jsonb_build_object('key','daily_answer_20','label','Answer 20 questions','desc','Any mix of drills or tests.','goal',20,'progress',LEAST(d_answered,20),'reward_sp',30,'kind','daily'),
      jsonb_build_object('key','daily_session','label','Finish a session','desc','Complete at least one drill or test.','goal',1,'progress',LEAST(d_sessions,1),'reward_sp',20,'kind','daily'),
      jsonb_build_object('key','daily_15min','label','Study 15 minutes','desc','Total time across sessions today.','goal',900,'progress',LEAST(d_seconds,900),'reward_sp',35,'kind','daily','unit','seconds')
    ),
    'weekly', jsonb_build_array(
      jsonb_build_object('key','weekly_answer_100','label','Answer 100 questions','desc','Across the week.','goal',100,'progress',LEAST(w_answered,100),'reward_sp',120,'kind','weekly'),
      jsonb_build_object('key','weekly_sessions_5','label','Complete 5 sessions','desc','Any mode counts.','goal',5,'progress',LEAST(w_sessions,5),'reward_sp',100,'kind','weekly'),
      jsonb_build_object('key','weekly_xp_500','label','Earn 500 XP','desc','Any XP earned this week.','goal',500,'progress',LEAST(w_xp,500),'reward_sp',150,'kind','weekly'),
      jsonb_build_object('key','weekly_hours_2','label','Study 2 hours','desc','Total time across the week.','goal',7200,'progress',LEAST(w_seconds,7200),'reward_sp',200,'kind','weekly','unit','seconds')
    ),
    'claimed', claimed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quest(_quest_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  today_d date := (now() AT TIME ZONE 'UTC')::date;
  week_key text := to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
  day_key text := today_d::text;
  period text;
  reward int;
  is_daily boolean;
  d_answered int; d_seconds int; d_sessions int;
  w_answered int; w_seconds int; w_sessions int; w_xp int;
  ok_complete boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  is_daily := _quest_key LIKE 'daily_%';
  period := CASE WHEN is_daily THEN day_key ELSE week_key END;

  IF is_daily THEN
    SELECT COALESCE(SUM(total),0), COALESCE(SUM(duration_seconds),0), COUNT(*)
      INTO d_answered, d_seconds, d_sessions
      FROM public.sessions WHERE user_id=uid AND (created_at AT TIME ZONE 'UTC')::date = today_d;
  ELSE
    SELECT COALESCE(SUM(total),0), COALESCE(SUM(duration_seconds),0), COUNT(*), COALESCE(SUM(xp_earned),0)
      INTO w_answered, w_seconds, w_sessions, w_xp
      FROM public.sessions WHERE user_id=uid AND created_at > now() - interval '7 days';
  END IF;

  CASE _quest_key
    WHEN 'daily_login'      THEN reward := 25; ok_complete := true;
    WHEN 'daily_answer_20'  THEN reward := 30; ok_complete := d_answered >= 20;
    WHEN 'daily_session'    THEN reward := 20; ok_complete := d_sessions >= 1;
    WHEN 'daily_15min'      THEN reward := 35; ok_complete := d_seconds >= 900;
    WHEN 'weekly_answer_100'THEN reward := 120; ok_complete := w_answered >= 100;
    WHEN 'weekly_sessions_5'THEN reward := 100; ok_complete := w_sessions >= 5;
    WHEN 'weekly_xp_500'    THEN reward := 150; ok_complete := w_xp >= 500;
    WHEN 'weekly_hours_2'   THEN reward := 200; ok_complete := w_seconds >= 7200;
    ELSE RETURN jsonb_build_object('ok', false, 'reason', 'unknown_quest');
  END CASE;

  IF NOT ok_complete THEN RETURN jsonb_build_object('ok', false, 'reason', 'incomplete'); END IF;

  BEGIN
    INSERT INTO public.quest_claims (user_id, quest_key, period_key, reward_sp)
      VALUES (uid, _quest_key, period, reward);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END;

  UPDATE public.profiles SET sp = sp + reward WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'reward_sp', reward);
END;
$$;
