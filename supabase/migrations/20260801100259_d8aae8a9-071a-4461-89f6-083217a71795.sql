UPDATE public.profiles p
SET display_name = COALESCE(NULLIF(trim(p.display_name), ''), NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''), NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), NULLIF(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
    avatar_url = COALESCE(NULLIF(p.avatar_url, ''), NULLIF(u.raw_user_meta_data->>'avatar_url', ''), NULLIF(u.raw_user_meta_data->>'picture', ''))
FROM auth.users u
WHERE u.id = p.id
  AND (p.display_name IS NULL OR trim(p.display_name) = '' OR p.avatar_url IS NULL OR p.avatar_url = '');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='reviews') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_user_summary()
RETURNS TABLE(user_id uuid, display_name text, email text, avatar_url text, xp integer, streak integer, focus_minutes_total integer, sessions_count bigint, session_minutes bigint, login_count integer, last_login_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id,
         COALESCE(NULLIF(trim(p.display_name), ''), NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''), NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), NULLIF(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
         u.email::text,
         COALESCE(NULLIF(p.avatar_url, ''), NULLIF(u.raw_user_meta_data->>'avatar_url', ''), NULLIF(u.raw_user_meta_data->>'picture', '')),
         p.xp, p.streak, p.focus_minutes_total,
         COALESCE((SELECT COUNT(*) FROM public.sessions s WHERE s.user_id = p.id), 0),
         COALESCE((SELECT SUM(s.duration_seconds)::bigint / 60 FROM public.sessions s WHERE s.user_id = p.id), 0),
         p.login_count, p.last_login_at, p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_top(_scope text, _limit integer DEFAULT 25)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, weekly_xp bigint, streak integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
    SELECT p.id,
      COALESCE(NULLIF(trim(p.display_name), ''), 'Cadet'),
      p.avatar_url,
      COALESCE((SELECT SUM(s.xp_earned) FROM public.sessions s WHERE s.user_id=p.id AND s.created_at > now() - interval '7 days'),0),
      p.streak
    FROM public.profiles p
    WHERE _scope <> 'friends' OR p.id = uid OR p.id IN (
      SELECT CASE WHEN f.user_id=uid THEN f.friend_id ELSE f.user_id END
      FROM public.friendships f WHERE (f.user_id=uid OR f.friend_id=uid) AND f.status='accepted'
    )
    ORDER BY 4 DESC LIMIT LEAST(GREATEST(_limit,1),100);
END $$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE(friendship_id uuid, friend_id uuid, display_name text, avatar_url text, status text, direction text, xp integer, streak integer, weekly_xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT f.id, other.id, COALESCE(NULLIF(trim(other.display_name), ''), 'Cadet'), other.avatar_url, f.status,
    CASE WHEN f.user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    other.xp, other.streak,
    COALESCE((SELECT SUM(s.xp_earned) FROM public.sessions s WHERE s.user_id = other.id AND s.created_at > now() - interval '7 days'), 0)
  FROM public.friendships f
  JOIN public.profiles other ON other.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
  WHERE f.user_id = auth.uid() OR f.friend_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.suggested_users(_limit integer DEFAULT 8)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, xp integer, streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, COALESCE(NULLIF(trim(p.display_name), ''), 'Cadet'), p.avatar_url, p.xp, p.streak
  FROM public.profiles p
  WHERE p.account_type = 'student' AND p.id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.user_id = auth.uid() AND f.friend_id = p.id) OR (f.user_id = p.id AND f.friend_id = auth.uid())
  )
  ORDER BY random() LIMIT LEAST(GREATEST(_limit,1),25)
$$;

CREATE OR REPLACE FUNCTION public.list_quests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid(); today_d date := (now() AT TIME ZONE 'UTC')::date;
  week_key text := to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW'); day_key text := today_d::text;
  d_answered int; d_seconds int; d_sessions int; w_answered int; w_seconds int; w_sessions int; w_xp int;
  claimed jsonb; day_variant int := mod(abs(hashtext(day_key)),3); week_variant int := mod(abs(hashtext(week_key)),3);
  daily_pool jsonb; weekly_pool jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT COALESCE(SUM(total),0), COALESCE(SUM(duration_seconds),0), COUNT(*) INTO d_answered,d_seconds,d_sessions FROM public.sessions WHERE user_id=uid AND (created_at AT TIME ZONE 'UTC')::date=today_d;
  SELECT COALESCE(SUM(total),0), COALESCE(SUM(duration_seconds),0), COUNT(*), COALESCE(SUM(xp_earned),0) INTO w_answered,w_seconds,w_sessions,w_xp FROM public.sessions WHERE user_id=uid AND created_at > date_trunc('week', now() AT TIME ZONE 'UTC');
  SELECT COALESCE(jsonb_agg(jsonb_build_object('quest_key',quest_key,'period_key',period_key)),'[]'::jsonb) INTO claimed FROM public.quest_claims WHERE user_id=uid AND period_key IN(day_key,week_key);
  daily_pool := CASE day_variant
    WHEN 0 THEN jsonb_build_array(
      jsonb_build_object('key','daily_answer_20','label','Answer 20 questions','desc','Any mix of drills or tests.','goal',20,'progress',LEAST(d_answered,20),'reward_sp',30,'kind','daily'),
      jsonb_build_object('key','daily_session','label','Finish a session','desc','Complete one drill or test.','goal',1,'progress',LEAST(d_sessions,1),'reward_sp',20,'kind','daily'),
      jsonb_build_object('key','daily_15min','label','Study 15 minutes','desc','Total practice time today.','goal',900,'progress',LEAST(d_seconds,900),'reward_sp',35,'kind','daily','unit','seconds'))
    WHEN 1 THEN jsonb_build_array(
      jsonb_build_object('key','daily_answer_30','label','Answer 30 questions','desc','Build accuracy with a longer set.','goal',30,'progress',LEAST(d_answered,30),'reward_sp',40,'kind','daily'),
      jsonb_build_object('key','daily_sessions_2','label','Finish 2 sessions','desc','Complete two focused sessions.','goal',2,'progress',LEAST(d_sessions,2),'reward_sp',35,'kind','daily'),
      jsonb_build_object('key','daily_20min','label','Study 20 minutes','desc','Total practice time today.','goal',1200,'progress',LEAST(d_seconds,1200),'reward_sp',45,'kind','daily','unit','seconds'))
    ELSE jsonb_build_array(
      jsonb_build_object('key','daily_answer_15','label','Answer 15 questions','desc','Complete a focused question set.','goal',15,'progress',LEAST(d_answered,15),'reward_sp',25,'kind','daily'),
      jsonb_build_object('key','daily_sessions_3','label','Finish 3 short sessions','desc','Stack three practice completions.','goal',3,'progress',LEAST(d_sessions,3),'reward_sp',45,'kind','daily'),
      jsonb_build_object('key','daily_25min','label','Study 25 minutes','desc','Total practice time today.','goal',1500,'progress',LEAST(d_seconds,1500),'reward_sp',50,'kind','daily','unit','seconds')) END;
  weekly_pool := CASE week_variant
    WHEN 0 THEN jsonb_build_array(
      jsonb_build_object('key','weekly_answer_100','label','Answer 100 questions','desc','Across this week.','goal',100,'progress',LEAST(w_answered,100),'reward_sp',120,'kind','weekly'),
      jsonb_build_object('key','weekly_sessions_5','label','Complete 5 sessions','desc','Any mode counts.','goal',5,'progress',LEAST(w_sessions,5),'reward_sp',100,'kind','weekly'),
      jsonb_build_object('key','weekly_hours_2','label','Study 2 hours','desc','Total time this week.','goal',7200,'progress',LEAST(w_seconds,7200),'reward_sp',200,'kind','weekly','unit','seconds'))
    WHEN 1 THEN jsonb_build_array(
      jsonb_build_object('key','weekly_answer_150','label','Answer 150 questions','desc','Across this week.','goal',150,'progress',LEAST(w_answered,150),'reward_sp',165,'kind','weekly'),
      jsonb_build_object('key','weekly_sessions_7','label','Complete 7 sessions','desc','Build a full week of reps.','goal',7,'progress',LEAST(w_sessions,7),'reward_sp',140,'kind','weekly'),
      jsonb_build_object('key','weekly_xp_700','label','Earn 700 XP','desc','Any XP earned this week.','goal',700,'progress',LEAST(w_xp,700),'reward_sp',180,'kind','weekly'))
    ELSE jsonb_build_array(
      jsonb_build_object('key','weekly_answer_200','label','Answer 200 questions','desc','Push through a high-volume week.','goal',200,'progress',LEAST(w_answered,200),'reward_sp',220,'kind','weekly'),
      jsonb_build_object('key','weekly_sessions_10','label','Complete 10 sessions','desc','Any mode counts.','goal',10,'progress',LEAST(w_sessions,10),'reward_sp',200,'kind','weekly'),
      jsonb_build_object('key','weekly_hours_3','label','Study 3 hours','desc','Total time this week.','goal',10800,'progress',LEAST(w_seconds,10800),'reward_sp',260,'kind','weekly','unit','seconds')) END;
  RETURN jsonb_build_object('day_key',day_key,'week_key',week_key,'daily',jsonb_build_array(jsonb_build_object('key','daily_login','label','Daily login bonus','desc','Free SP for showing up.','goal',1,'progress',1,'reward_sp',25,'kind','daily')) || daily_pool,'weekly',weekly_pool,'claimed',claimed);
END $$;

CREATE OR REPLACE FUNCTION public.claim_quest(_quest_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid:=auth.uid(); today_d date:=(now() AT TIME ZONE 'UTC')::date; week_key text:=to_char(now() AT TIME ZONE 'UTC','IYYY-"W"IW'); day_key text:=today_d::text; period text; reward int; goal int; metric int; is_daily boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  is_daily := _quest_key LIKE 'daily_%'; period:=CASE WHEN is_daily THEN day_key ELSE week_key END;
  SELECT CASE
    WHEN _quest_key='daily_login' THEN 25 WHEN _quest_key='daily_answer_15' THEN 25 WHEN _quest_key='daily_answer_20' THEN 30 WHEN _quest_key='daily_answer_30' THEN 40
    WHEN _quest_key='daily_session' THEN 20 WHEN _quest_key='daily_sessions_2' THEN 35 WHEN _quest_key='daily_sessions_3' THEN 45
    WHEN _quest_key='daily_15min' THEN 35 WHEN _quest_key='daily_20min' THEN 45 WHEN _quest_key='daily_25min' THEN 50
    WHEN _quest_key='weekly_answer_100' THEN 120 WHEN _quest_key='weekly_answer_150' THEN 165 WHEN _quest_key='weekly_answer_200' THEN 220
    WHEN _quest_key='weekly_sessions_5' THEN 100 WHEN _quest_key='weekly_sessions_7' THEN 140 WHEN _quest_key='weekly_sessions_10' THEN 200
    WHEN _quest_key='weekly_xp_700' THEN 180 WHEN _quest_key='weekly_hours_2' THEN 200 WHEN _quest_key='weekly_hours_3' THEN 260 ELSE NULL END INTO reward;
  IF reward IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unknown_quest'); END IF;
  IF _quest_key='daily_login' THEN metric:=1; goal:=1;
  ELSIF _quest_key LIKE 'daily_answer_%' THEN SELECT COALESCE(SUM(total),0) INTO metric FROM public.sessions WHERE user_id=uid AND (created_at AT TIME ZONE 'UTC')::date=today_d; goal:=substring(_quest_key from '[0-9]+')::int;
  ELSIF _quest_key LIKE 'daily_session%' THEN SELECT COUNT(*) INTO metric FROM public.sessions WHERE user_id=uid AND (created_at AT TIME ZONE 'UTC')::date=today_d; goal:=COALESCE(NULLIF(substring(_quest_key from '[0-9]+'),''),'1')::int;
  ELSIF _quest_key LIKE 'daily_%min' THEN SELECT COALESCE(SUM(duration_seconds),0) INTO metric FROM public.sessions WHERE user_id=uid AND (created_at AT TIME ZONE 'UTC')::date=today_d; goal:=substring(_quest_key from '[0-9]+')::int*60;
  ELSIF _quest_key LIKE 'weekly_answer_%' THEN SELECT COALESCE(SUM(total),0) INTO metric FROM public.sessions WHERE user_id=uid AND created_at>=date_trunc('week',now() AT TIME ZONE 'UTC'); goal:=substring(_quest_key from '[0-9]+')::int;
  ELSIF _quest_key LIKE 'weekly_sessions_%' THEN SELECT COUNT(*) INTO metric FROM public.sessions WHERE user_id=uid AND created_at>=date_trunc('week',now() AT TIME ZONE 'UTC'); goal:=substring(_quest_key from '[0-9]+')::int;
  ELSIF _quest_key LIKE 'weekly_xp_%' THEN SELECT COALESCE(SUM(xp_earned),0) INTO metric FROM public.sessions WHERE user_id=uid AND created_at>=date_trunc('week',now() AT TIME ZONE 'UTC'); goal:=substring(_quest_key from '[0-9]+')::int;
  ELSE SELECT COALESCE(SUM(duration_seconds),0) INTO metric FROM public.sessions WHERE user_id=uid AND created_at>=date_trunc('week',now() AT TIME ZONE 'UTC'); goal:=substring(_quest_key from '[0-9]+')::int*3600; END IF;
  IF metric<goal THEN RETURN jsonb_build_object('ok',false,'reason','incomplete'); END IF;
  BEGIN INSERT INTO public.quest_claims(user_id,quest_key,period_key,reward_sp) VALUES(uid,_quest_key,period,reward); EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'reason','already_claimed'); END;
  UPDATE public.profiles SET sp=sp+reward WHERE id=uid;
  RETURN jsonb_build_object('ok',true,'reward_sp',reward);
END $$;