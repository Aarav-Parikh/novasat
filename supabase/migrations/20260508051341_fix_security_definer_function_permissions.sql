/*
  # Fix SECURITY DEFINER Function Permissions

  ## Summary
  Revokes public/unnecessary EXECUTE permissions on SECURITY DEFINER functions
  to prevent privilege escalation. Several trigger functions were callable via
  the REST API by any role, and admin functions were callable by any authenticated
  user (not just admins).

  ## Changes

  ### 1. `handle_new_user()` — Trigger function
  - Revoke EXECUTE from `anon` and `authenticated`
  - This is a PostgreSQL trigger function called automatically on INSERT to
    `auth.users`. It should NEVER be callable via REST RPC.
  - SECURITY DEFINER is appropriate (needs to insert into `public.profiles`),
    but EXECUTE must be restricted to the database system only.

  ### 2. `touch_updated_at()` — Trigger function
  - Revoke EXECUTE from `anon` and `authenticated`
  - This is a trigger function that sets `updated_at = now()`. It should NEVER
    be callable via REST RPC.
  - Switch to SECURITY INVOKER since it only reads/writes the current row
    (no elevated privileges needed).

  ### 3. `admin_all_reviews()`, `admin_global_stats()`, `admin_user_summary()`
  - Revoke EXECUTE from `authenticated`
  - These are admin-only functions that return sensitive data (all reviews,
    global stats, all user profiles).
  - The function bodies already check `has_role(auth.uid(), 'admin')` and
    return empty results for non-admins, but EXECUTE should still be restricted
    to prevent any authenticated user from invoking them.
  - Grant EXECUTE only to users with the 'admin' role via a dedicated role or
    keep revoked and call via service role key from edge functions.

  ### 4. `has_role()` — Authorization helper
  - Revoke EXECUTE from `authenticated`
  - This function checks if a user has a specific role. It is used internally
    by admin functions. It should not be directly callable via REST RPC as it
    could be used to probe role assignments.
  - Other SQL functions in the database can still call it internally.

  ### 5. `bump_ai_usage()` — AI usage counter
  - Keep EXECUTE on `authenticated` (already restricted)
  - The function body validates `auth.uid() = _user_id`, preventing users from
    bumping other users' counts.
  - SECURITY DEFINER is needed because `ai_usage` table may not have per-user
    INSERT policies, and the function handles upsert logic safely.
  - No change needed.

  ## Security Impact
  - Eliminates 2 functions callable by `anon` role (handle_new_user, touch_updated_at)
  - Eliminates 4 functions callable by any `authenticated` user (admin_*, has_role)
  - Admin functions remain callable by the postgres/service role for backend use
*/

-- 1. Revoke EXECUTE on trigger functions from all non-system roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

-- 2. Switch touch_updated_at to SECURITY INVOKER (it only touches the current row)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

-- 3. Revoke EXECUTE on admin functions from authenticated role
REVOKE EXECUTE ON FUNCTION public.admin_all_reviews() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_summary() FROM authenticated;

-- 4. Revoke EXECUTE on has_role from authenticated (used internally by admin functions)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
