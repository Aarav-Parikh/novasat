/*
  # Fix has_role EXECUTE permission for RLS policies

  ## Summary
  The previous security migration revoked EXECUTE on `has_role()` from
  `authenticated`, but several RLS policies on `user_roles` depend on
  calling `has_role()`. Without EXECUTE permission, these policies
  silently fail and return no rows, breaking admin access checks.

  ## Fix
  Re-grant EXECUTE on `has_role()` to `authenticated` so RLS policies
  can function. The function is STABLE and only reads from `user_roles`,
  so exposing it is safe — it simply checks whether a user has a role.
  The real protection is the RLS policies on the tables that use it.

  ## Security Impact
  - `has_role()` is a read-only function that checks role membership
  - It's needed by RLS policies on `user_roles` table
  - Calling it via RPC only reveals whether a specific user_id has a
    specific role, which is low-risk since the caller already knows
    their own user_id
*/

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
