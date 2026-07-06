# Standout Features: Social Layer + Parent/Tutor Dashboard

Two big adds that most AI SAT apps don't have. Both lean on the server-authoritative economy and IRT score engine you already own, so they compound existing strengths instead of bolting on new ones.

---

## Part A — Social Layer

### A1. Global + friends leaderboards
- New page `/leaderboard` with three tabs: **Global (weekly XP)**, **Friends**, **My Club**.
- Backed by RPC `leaderboard_top(_scope text, _limit int)` reading from `profiles` + `sessions`. Uses `display_name` only — no emails.
- Weekly reset via `week_start` computed in the RPC (UTC Monday).

### A2. Friends system
- New table `friendships(user_id, friend_id, status: pending|accepted, created_at)` with symmetric rows on accept.
- RPCs: `send_friend_request(_display_name)`, `respond_friend_request(_id, _accept bool)`, `list_friends()`.
- Simple `/friends` page: search by display name, pending inbox, accepted list with each friend's streak + weekly XP.

### A3. Head-to-head duels (5-question race)
- New tables:
  - `duels(id, challenger_id, opponent_id, section, status: pending|active|complete, question_ids jsonb, started_at, expires_at, winner_id)`
  - `duel_answers(duel_id, user_id, q_index, correct bool, time_ms int)`
- Flow:
  1. Challenger picks section (Math / R&W) + opponent → RPC `create_duel` pre-generates 5 questions (reuses `generate-questions` edge fn).
  2. Opponent accepts → both play the same 5 questions in a stripped-down `TestSession` variant (`/duel/:id`).
  3. Winner = more correct, tiebreak faster total time. RPC `finalize_duel` awards +30 XP winner / +10 XP loser and logs to `sessions` as `mode='duel'` (add to allowed modes).
- Realtime: subscribe to `duels` + `duel_answers` for live "opponent finished Q3" indicator.

### A4. Clubs (study groups)
- Tables:
  - `clubs(id, name, slug unique, owner_id, join_code text, created_at)`
  - `club_members(club_id, user_id, role: owner|member, joined_at)`
- Page `/clubs`: create club, join by code, member list with weekly XP + streak, club-scoped leaderboard.
- Max 50 members per club (enforced in RPC).

### A5. Streak-freeze consumable
- Add `streak_freezes int` to `profiles` (default 1, +1 every 7-day streak milestone).
- RPC `use_streak_freeze()` — call automatically in `record_session_rewards` if user missed yesterday but has a freeze.

---

## Part B — Parent/Tutor Dashboard + Readiness Score

### B1. Share link
- Table `progress_shares(id, user_id, slug unique, is_active bool, created_at, revoked_at)`.
- RPC `create_share_link()` / `revoke_share_link(_id)`.
- Public route `/share/:slug` — no auth required, rate-limited via edge function `public-progress` that:
  - Validates slug + `is_active`.
  - Returns curated read-only payload: display_name (first name only), target score, projected score + interval, weekly XP, hours logged, streak, section accuracy, top 3 weak topics, last-7-days activity sparkline, readiness score.
  - Never exposes email, mistakes text, or admin data.
- Owner-side UI on `/profile`: "Share progress with parent/tutor" → copy link, toggle active, revoke.

### B2. Readiness score (test-day forecast)
- New pure function `computeReadiness(sessions, mistakes, targetScore, testDate)` in `src/lib/readiness.ts` returning `{ score: 0-100, band: 'off-track'|'on-track'|'ahead', reasons: string[] }`.
- Inputs: current projected score vs target, sessions/week trend, accuracy trend, days until test, weak-topic coverage.
- Rendered on `/app` as a new "Test-Day Readiness" card (ring gauge + band label + top 2 reasons) and on the public share page.

### B3. "What to cram this week" widget
- Same weak-topic list already in `WeakAreas.tsx`, but re-ranked by `(mistake_count * days_until_test_weight)` and capped at 5 topics with 1-line "why this matters" copy.
- Shown on `/app` and on the share page.

---

## Technical Details

### New tables (all get GRANT + RLS)
- `friendships`, `duels`, `duel_answers`, `clubs`, `club_members`, `progress_shares`.
- RLS: users see only their own rows / rows they participate in. `progress_shares` public read via SECURITY DEFINER edge function only.

### Schema additions to `profiles`
- `streak_freezes int default 1`
- `target_test_date date` (already may exist — check first; add if missing)

### New RPCs
`leaderboard_top`, `send_friend_request`, `respond_friend_request`, `list_friends`, `create_duel`, `submit_duel_answer`, `finalize_duel`, `create_club`, `join_club`, `create_share_link`, `revoke_share_link`, `use_streak_freeze`.

All state-changing RPCs are `SECURITY DEFINER` with `auth.uid()` checks, matching the project's "server-authoritative economy" core rule.

### New edge functions
- `public-progress` — read-only, no JWT, validates share slug, returns curated JSON.

### Realtime
- Enable Realtime on `duels` and `duel_answers` only (via `ALTER PUBLICATION supabase_realtime ADD TABLE ...`).
- Subscribe inside `useEffect` with cleanup in the duel page.

### New pages
- `/leaderboard`, `/friends`, `/clubs`, `/clubs/:slug`, `/duel/:id`, `/share/:slug` (public).

### Sidebar
- Add "Social" section with Leaderboard, Friends, Clubs.

### Out of scope for this pass
- In-app chat / DMs (moderation surface too big).
- Real-money tournaments.
- Parent-side login (share link is enough for v1).
- Duel matchmaking with strangers (friends-only for v1 to avoid abuse).

---

## Build order
1. Migration: new tables + `streak_freezes` + RPCs + Realtime publication.
2. `readiness.ts` + Test-Day Readiness card on `/app`.
3. Friends + Leaderboard pages.
4. Clubs.
5. Duels (biggest piece — new session variant + realtime).
6. Public share link + `public-progress` edge function + `/share/:slug` page.
7. Sidebar entries + polish.

Reply **"go"** and I'll execute in that order. If any piece should be dropped or narrowed (e.g. skip clubs, ship duels first), say which.
