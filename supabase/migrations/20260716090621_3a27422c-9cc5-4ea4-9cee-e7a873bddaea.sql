
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  final_name text;
  final_avatar text;
begin
  final_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );
  final_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', '')
  );

  insert into public.profiles (id, display_name, account_type, avatar_url)
  values (new.id, final_name, 'student', final_avatar)
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_url   = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.mystery_boxes (user_id, level_number, tier, reward_label)
  values (new.id, 0, 'rare', 'Starter Box')
  on conflict do nothing;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.friendships
    WHERE id = _id AND user_id = uid AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_user_summary();
CREATE OR REPLACE FUNCTION public.admin_user_summary()
RETURNS TABLE(
  user_id uuid, display_name text, email text, avatar_url text,
  xp integer, streak integer, focus_minutes_total integer,
  sessions_count bigint, session_minutes bigint,
  login_count integer, last_login_at timestamp with time zone, created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, u.email::text, p.avatar_url,
         p.xp, p.streak, p.focus_minutes_total,
         COALESCE((SELECT COUNT(*) FROM public.sessions s WHERE s.user_id = p.id), 0),
         COALESCE((SELECT SUM(duration_seconds)/60 FROM public.sessions s WHERE s.user_id = p.id), 0),
         p.login_count, p.last_login_at, p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC
$function$;

-- Update leaderboard/list_friends/suggested_users to include avatar_url
DROP FUNCTION IF EXISTS public.list_friends();
CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE(friendship_id uuid, friend_id uuid, display_name text, avatar_url text, status text, direction text, xp integer, streak integer, weekly_xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT f.id, other.id, other.display_name, other.avatar_url, f.status,
    CASE WHEN f.user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    other.xp, other.streak,
    COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id = other.id AND s.created_at > now() - interval '7 days'), 0)
  FROM public.friendships f
  JOIN public.profiles other ON other.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
  WHERE f.user_id = auth.uid() OR f.friend_id = auth.uid()
$function$;

DROP FUNCTION IF EXISTS public.suggested_users(integer);
CREATE OR REPLACE FUNCTION public.suggested_users(_limit integer DEFAULT 8)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, xp integer, streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, p.avatar_url, p.xp, p.streak
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
$function$;

DROP FUNCTION IF EXISTS public.leaderboard_top(text, integer);
CREATE OR REPLACE FUNCTION public.leaderboard_top(_scope text, _limit integer DEFAULT 25)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, weekly_xp bigint, streak integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _scope = 'friends' THEN
    RETURN QUERY
      SELECT p.id, p.display_name, p.avatar_url,
        COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id=p.id AND s.created_at > now() - interval '7 days'),0),
        p.streak
      FROM public.profiles p
      WHERE p.id = uid OR p.id IN (
        SELECT CASE WHEN f.user_id=uid THEN f.friend_id ELSE f.user_id END
        FROM public.friendships f WHERE (f.user_id=uid OR f.friend_id=uid) AND f.status='accepted'
      )
      ORDER BY 4 DESC LIMIT LEAST(_limit, 100);
  ELSE
    RETURN QUERY
      SELECT p.id, p.display_name, p.avatar_url,
        COALESCE((SELECT SUM(xp_earned) FROM public.sessions s WHERE s.user_id=p.id AND s.created_at > now() - interval '7 days'),0),
        p.streak
      FROM public.profiles p
      ORDER BY 4 DESC LIMIT LEAST(_limit, 100);
  END IF;
END; $function$;
