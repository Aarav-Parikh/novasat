ALTER TABLE public.mystery_boxes DROP CONSTRAINT IF EXISTS mystery_boxes_level_number_check;
ALTER TABLE public.mystery_boxes ADD CONSTRAINT mystery_boxes_level_number_check CHECK (level_number >= 0);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
  set display_name = coalesce(public.profiles.display_name, excluded.display_name);

  insert into public.mystery_boxes (user_id, level_number, tier, reward_label)
  values (new.id, 0, 'rare', 'Starter Box')
  on conflict do nothing;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.mystery_boxes (user_id, level_number, tier, reward_label)
SELECT p.id, 0, 'rare', 'Starter Box'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.mystery_boxes mb
  WHERE mb.user_id = p.id
    AND mb.level_number = 0
);