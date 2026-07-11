# Big polish pass

Ten distinct changes. Grouped by area.

## 1. Dashboard layout
- Move Buddy's level/energy bar so it sits on the LEFT column, directly beneath the treats card. Right column keeps its current widgets.

## 2. Email confirmation for new signups
- Turn OFF auto-confirm via `configure_auth`.
- After signup, show a toast/modal: "Check your inbox and confirm your email before signing in."
- Do NOT change existing accounts.

## 3. Badge earned popup
- Central `BadgeToast` component: green glowing badge icon + name + description.
- Fire it whenever `record_session_rewards` unlocks a new badge (client-side detection based on profile deltas: streak milestones, XP thresholds, first duel win, etc.). Existing badge list will drive it — if there is no badge system yet, add a lightweight one keyed off profile stats.

## 4. Remove Clubs → add Quests
- Delete `/clubs`, `/clubs/:slug`, sidebar link, `ClubDetail`, `Clubs` pages.
- New `/quests` page. Move "Claim daily SP" and any "ways to earn SP" copy from Store into Quests.
- Quests table with `kind` = `daily` | `weekly`, `goal`, `progress`, `reward_sp`, `reset_at`.
- Daily: answer 20 questions, 80%+ accuracy on a drill, 15-min session, claim daily SP.
- Weekly (longer): 100 questions, 3-day streak maintained, complete a full section test, earn 500 XP.
- Server RPCs: `list_quests`, `claim_quest`. Progress computed on demand from `sessions` and `profiles`.

## 5. Predicted SAT score → range
- `Index.tsx` and any readout: show `projectedLow–projectedHigh` (already computed in `deriveNovaStats`) instead of a single number.

## 6. Remove Challenge Friend
- Strip Challenge buttons + duel inbox from `/friends`.
- Keep the `/duel/:id` route running (still reachable from an old link) but no UI entry point.

## 7. Friends UX
- Add "Request sent" toast on send.
- Add email lookup: new RPC `send_friend_request_by_email(_email)` that resolves email → user via `auth.users` (security definer).
- "Suggested users" list: RPC `suggested_users(_limit)` returning 10 random profiles that are not self and not already friends/pending.

## 8. Parent accounts (replace share links)
- New `account_type` enum on profiles: `student` | `parent`.
- Signup form: radio for account type.
- Parent account: `parent_links` table (`parent_id`, `student_id`, `status` pending/accepted). Parent enters child's email/username → child accepts from a "Parent requests" section on their profile.
- Parent home = read-only dashboard of linked child (reuses PublicShare-style stats view). No practice/test routes for parents — `RequireStudent` wrapper blocks them.
- Delete `ShareLinkPanel`, `progress_shares` UI, `/share/:slug` public page.

## 9. Leaderboard: real names
- Root cause: RPC returns `display_name` but UI masks. Fix Leaderboard.tsx to render `row.display_name` directly (fall back to "Cadet" only if null).

## 10. Signup: username field
- Already has `display_name` in signup — rename label to "Username", require it, enforce unique via profiles constraint. Add unique index on `lower(display_name)`.

## Technical notes
- One migration handling: auto-confirm off is done via `configure_auth` (not SQL). SQL migration handles: quests tables + RPCs, `account_type` column, `parent_links` table + RPCs, unique username index, drop `progress_shares` policies/table (keep table if data exists — just hide UI), suggested-users + email-lookup RPCs.
- Frontend touches: `Index.tsx`, `Profile.tsx`, `Friends.tsx`, `Auth.tsx`, `AppSidebar.tsx`, `App.tsx` routes, new `Quests.tsx`, new `ParentHome.tsx`, new `BadgeToast.tsx`, delete/hide Clubs + Share components.

## Out of scope
- Rebuilding badges from scratch if none exist beyond streak/XP milestones — will use profile-derived milestones only.
- Email deliverability/custom templates.
