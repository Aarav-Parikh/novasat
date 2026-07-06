
-- 1. Profile addition
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_freezes int NOT NULL DEFAULT 1;

-- 2. Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own friendship rows" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "no direct writes friendships" ON public.friendships FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- 3. Duels
CREATE TABLE IF NOT EXISTS public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_id uuid,
  challenger_correct int NOT NULL DEFAULT 0,
  opponent_correct int NOT NULL DEFAULT 0,
  challenger_time_ms int NOT NULL DEFAULT 0,
  opponent_time_ms int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finalized_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duels TO authenticated;
GRANT ALL ON public.duels TO service_role;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duel participants read" ON public.duels FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "no direct writes duels" ON public.duels FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.duel_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  q_index int NOT NULL,
  correct boolean NOT NULL,
  time_ms int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(duel_id, user_id, q_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duel_answers TO authenticated;
GRANT ALL ON public.duel_answers TO service_role;
ALTER TABLE public.duel_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duel_answers read participants" ON public.duel_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.duels d WHERE d.id = duel_id AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())));
CREATE POLICY "no direct writes duel_answers" ON public.duel_answers FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- 4. Clubs
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  join_code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_members (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helper to avoid recursive RLS between clubs and club_members
CREATE OR REPLACE FUNCTION public.is_club_member(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.club_members WHERE club_id = _club_id AND user_id = _user_id)
$$;

CREATE POLICY "clubs member read" ON public.clubs FOR SELECT TO authenticated
  USING (public.is_club_member(id, auth.uid()));
CREATE POLICY "no direct writes clubs" ON public.clubs FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "club_members read own clubs" ON public.club_members FOR SELECT TO authenticated
  USING (public.is_club_member(club_id, auth.uid()));
CREATE POLICY "no direct writes club_members" ON public.club_members FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- 5. Progress shares
CREATE TABLE IF NOT EXISTS public.progress_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_shares TO authenticated;
GRANT ALL ON public.progress_shares TO service_role;
ALTER TABLE public.progress_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress shares" ON public.progress_shares FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "no direct writes progress_shares" ON public.progress_shares FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- 6. RPCs

-- Friend request by display name
CREATE OR REPLACE FUNCTION public.send_friend_request(_display_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); target uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO target FROM public.profiles WHERE lower(display_name) = lower(_display_name) LIMIT 1;
  IF target IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF target = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE (user_id=uid AND friend_id=target) OR (user_id=target AND friend_id=uid)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exists');
  END IF;
  INSERT INTO public.friendships (user_id, friend_id, status) VALUES (uid, target, 'pending');
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_id uuid, _accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.friendships%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO r FROM public.friendships WHERE id=_id AND friend_id=uid AND status='pending';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF _accept THEN
    UPDATE public.friendships SET status='accepted' WHERE id=_id;
    INSERT INTO public.friendships (user_id, friend_id, status) VALUES (uid, r.user_id, 'accepted')
      ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.friendships WHERE id=_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE(friendship_id uuid, friend_id uuid, display_name text, status text, direction text, xp int, streak int, weekly_xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, other.id, other.display_name, f.status,
    CASE WHEN f.user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    other.xp, other.streak,
    COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id = other.id AND s.created_at > now() - interval '7 days'), 0)
  FROM public.friendships f
  JOIN public.profiles other ON other.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
  WHERE f.user_id = auth.uid() OR f.friend_id = auth.uid()
$$;

-- Leaderboards
CREATE OR REPLACE FUNCTION public.leaderboard_top(_scope text, _limit int DEFAULT 25)
RETURNS TABLE(user_id uuid, display_name text, weekly_xp bigint, streak int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _scope = 'friends' THEN
    RETURN QUERY
      SELECT p.id, p.display_name,
        COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id=p.id AND s.created_at > now() - interval '7 days'),0),
        p.streak
      FROM public.profiles p
      WHERE p.id = uid OR p.id IN (
        SELECT CASE WHEN f.user_id=uid THEN f.friend_id ELSE f.user_id END
        FROM public.friendships f WHERE (f.user_id=uid OR f.friend_id=uid) AND f.status='accepted'
      )
      ORDER BY 3 DESC LIMIT LEAST(_limit, 100);
  ELSE
    RETURN QUERY
      SELECT p.id, p.display_name,
        COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id=p.id AND s.created_at > now() - interval '7 days'),0),
        p.streak
      FROM public.profiles p
      ORDER BY 3 DESC LIMIT LEAST(_limit, 100);
  END IF;
END; $$;

-- Duels
CREATE OR REPLACE FUNCTION public.create_duel(_opponent_display_name text, _section text, _questions jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); opp uuid; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO opp FROM public.profiles WHERE lower(display_name)=lower(_opponent_display_name) LIMIT 1;
  IF opp IS NULL OR opp = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_opponent'); END IF;
  INSERT INTO public.duels (challenger_id, opponent_id, section, questions, status, started_at)
    VALUES (uid, opp, _section, _questions, 'active', now())
    RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'duel_id', new_id);
END; $$;

CREATE OR REPLACE FUNCTION public.submit_duel_answer(_duel_id uuid, _q_index int, _correct boolean, _time_ms int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.duels WHERE id=_duel_id AND (challenger_id=uid OR opponent_id=uid)) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  INSERT INTO public.duel_answers (duel_id, user_id, q_index, correct, time_ms)
    VALUES (_duel_id, uid, _q_index, _correct, GREATEST(0,_time_ms))
    ON CONFLICT (duel_id, user_id, q_index) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_duel(_duel_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.duels%ROWTYPE;
  c_correct int; o_correct int; c_time int; o_time int;
  q_count int; winner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO d FROM public.duels WHERE id=_duel_id FOR UPDATE;
  IF NOT FOUND OR (d.challenger_id <> uid AND d.opponent_id <> uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF d.status = 'complete' THEN
    RETURN jsonb_build_object('ok', true, 'winner_id', d.winner_id, 'already', true);
  END IF;
  q_count := COALESCE(jsonb_array_length(d.questions), 5);
  SELECT COALESCE(SUM(CASE WHEN correct THEN 1 ELSE 0 END),0), COALESCE(SUM(time_ms),0)
    INTO c_correct, c_time FROM public.duel_answers WHERE duel_id=_duel_id AND user_id=d.challenger_id;
  SELECT COALESCE(SUM(CASE WHEN correct THEN 1 ELSE 0 END),0), COALESCE(SUM(time_ms),0)
    INTO o_correct, o_time FROM public.duel_answers WHERE duel_id=_duel_id AND user_id=d.opponent_id;
  IF (SELECT COUNT(*) FROM public.duel_answers WHERE duel_id=_duel_id) < q_count * 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'incomplete');
  END IF;
  IF c_correct > o_correct THEN winner := d.challenger_id;
  ELSIF o_correct > c_correct THEN winner := d.opponent_id;
  ELSIF c_time < o_time THEN winner := d.challenger_id;
  ELSIF o_time < c_time THEN winner := d.opponent_id;
  ELSE winner := NULL; END IF;

  UPDATE public.duels SET status='complete', winner_id=winner, finalized_at=now(),
    challenger_correct=c_correct, opponent_correct=o_correct,
    challenger_time_ms=c_time, opponent_time_ms=o_time
    WHERE id=_duel_id;

  UPDATE public.profiles SET xp = xp + CASE WHEN id = winner THEN 30 ELSE 10 END
    WHERE id IN (d.challenger_id, d.opponent_id);
  INSERT INTO public.sessions (user_id, mode, score, total, duration_seconds, xp_earned) VALUES
    (d.challenger_id, 'duel', c_correct, q_count, GREATEST(1, c_time/1000), CASE WHEN winner=d.challenger_id THEN 30 ELSE 10 END),
    (d.opponent_id,   'duel', o_correct, q_count, GREATEST(1, o_time/1000), CASE WHEN winner=d.opponent_id   THEN 30 ELSE 10 END);
  RETURN jsonb_build_object('ok', true, 'winner_id', winner);
END; $$;

-- Clubs
CREATE OR REPLACE FUNCTION public.create_club(_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); new_id uuid; s text; code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _name IS NULL OR length(trim(_name)) < 2 THEN RETURN jsonb_build_object('ok', false, 'reason', 'name'); END IF;
  s := lower(regexp_replace(trim(_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text),1,6);
  code := upper(substr(md5(random()::text),1,6));
  INSERT INTO public.clubs (name, slug, join_code, owner_id) VALUES (trim(_name), s, code, uid) RETURNING id INTO new_id;
  INSERT INTO public.club_members (club_id, user_id, role) VALUES (new_id, uid, 'owner');
  RETURN jsonb_build_object('ok', true, 'club_id', new_id, 'slug', s, 'join_code', code);
END; $$;

CREATE OR REPLACE FUNCTION public.join_club(_join_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c_id uuid; c_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO c_id FROM public.clubs WHERE upper(join_code) = upper(trim(_join_code));
  IF c_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT COUNT(*) INTO c_count FROM public.club_members WHERE club_id = c_id;
  IF c_count >= 50 THEN RETURN jsonb_build_object('ok', false, 'reason', 'full'); END IF;
  INSERT INTO public.club_members (club_id, user_id, role) VALUES (c_id, uid, 'member')
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'club_id', c_id);
END; $$;

CREATE OR REPLACE FUNCTION public.club_leaderboard(_club_id uuid)
RETURNS TABLE(user_id uuid, display_name text, weekly_xp bigint, streak int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_club_member(_club_id, auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT p.id, p.display_name,
      COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id=p.id AND s.created_at > now() - interval '7 days'),0),
      p.streak
    FROM public.club_members cm JOIN public.profiles p ON p.id = cm.user_id
    WHERE cm.club_id = _club_id ORDER BY 3 DESC;
END; $$;

-- Shares
CREATE OR REPLACE FUNCTION public.create_share_link()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s text; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  s := substr(md5(random()::text || uid::text || now()::text), 1, 14);
  INSERT INTO public.progress_shares (user_id, slug) VALUES (uid, s) RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'id', new_id, 'slug', s);
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_share_link(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.progress_shares SET is_active=false, revoked_at=now() WHERE id=_id AND user_id=auth.uid();
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_progress(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sh public.progress_shares%ROWTYPE; p public.profiles%ROWTYPE;
  weekly_xp bigint; total_seconds bigint; total_answered bigint; total_correct bigint;
  top_topics jsonb;
BEGIN
  SELECT * INTO sh FROM public.progress_shares WHERE slug = _slug AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT * INTO p FROM public.profiles WHERE id = sh.user_id;
  SELECT COALESCE(SUM(xp_earned),0), COALESCE(SUM(duration_seconds),0),
         COALESCE(SUM(total),0), COALESCE(SUM(score),0)
    INTO weekly_xp, total_seconds, total_answered, total_correct
    FROM public.sessions WHERE user_id = sh.user_id AND created_at > now() - interval '7 days';
  SELECT jsonb_agg(t) INTO top_topics FROM (
    SELECT topic, COUNT(*) AS misses FROM public.mistakes WHERE user_id = sh.user_id AND topic IS NOT NULL
    GROUP BY topic ORDER BY 2 DESC LIMIT 3
  ) t;
  RETURN jsonb_build_object(
    'ok', true,
    'display_name', split_part(COALESCE(p.display_name,'Student'), ' ', 1),
    'target_score', p.target_score,
    'test_date', p.test_date,
    'xp', p.xp,
    'streak', p.streak,
    'weekly_xp', weekly_xp,
    'hours_logged', ROUND(total_seconds/3600.0, 1),
    'accuracy', CASE WHEN total_answered>0 THEN ROUND(100.0*total_correct/total_answered) ELSE 0 END,
    'top_weak_topics', COALESCE(top_topics, '[]'::jsonb)
  );
END; $$;

-- Streak freeze consumable
CREATE OR REPLACE FUNCTION public.use_streak_freeze()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); prof public.profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF prof.streak_freezes <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'none'); END IF;
  UPDATE public.profiles SET streak_freezes = streak_freezes - 1 WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'remaining', prof.streak_freezes - 1);
END; $$;

-- Grants on new functions
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_duel(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_duel_answer(uuid, int, boolean, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_duel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_club(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_club(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_share_link() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_progress(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_streak_freeze() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_answers;
