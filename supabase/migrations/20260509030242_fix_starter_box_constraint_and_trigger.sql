/*
  # Fix starter box: allow level_number = 0 and auto-create on signup

  ## Summary
  The mystery_boxes table had a CHECK constraint requiring level_number > 0,
  which prevented creating a free starter box at level 0. This migration:
  1. Drops the old constraint and adds a new one allowing level_number >= 0
  2. Updates the handle_new_user() trigger to auto-create a starter box
     for every new user upon signup

  ## Changes
  - Drop constraint `mystery_boxes_level_number_check`
  - Add new constraint allowing level_number >= 0
  - Update `handle_new_user()` to insert a starter mystery box (level 0, rare tier)
    for each new user alongside their profile

  ## Security
  - handle_new_user is a SECURITY DEFINER trigger function (runs as postgres)
  - EXECUTE was already revoked from anon and authenticated in a prior migration
  - The trigger fires automatically on INSERT to auth.users, not via RPC
*/

-- 1. Drop the old check constraint and replace with one allowing level_number >= 0
ALTER TABLE public.mystery_boxes DROP CONSTRAINT IF EXISTS mystery_boxes_level_number_check;
ALTER TABLE public.mystery_boxes ADD CONSTRAINT mystery_boxes_level_number_check
  CHECK (level_number >= 0);

-- 2. Update handle_new_user to also create a starter box
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.mystery_boxes (user_id, level_number, tier, reward_label)
  values (new.id, 0, 'rare', 'Starter Box');

  return new;
end;
$function$;
