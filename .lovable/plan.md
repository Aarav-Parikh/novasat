# NovaSAT — Full Regeneration Prompt

Use this as a single prompt to rebuild the current app end-to-end. It captures every page, mechanic, model, table, and visual choice that exists today.

## 1. Product summary

Build **NovaSAT**, a gamified, AI-powered Digital SAT prep web app. It generates 100% original SAT-style questions on demand, predicts a scaled SAT score (400–1600) with a confidence range, surfaces weak topics, builds a daily routine, and wraps the whole experience in an XP / SP / mystery-box / boost economy. Independent practice product; not affiliated with College Board.

Stack: **React 18 + Vite + TypeScript + Tailwind v3 + shadcn/ui + React Router + Zustand + TanStack Query + Recharts + Lovable Cloud (Supabase) + Supabase Edge Functions + OpenRouter (Gemini/Llama) for question generation.**

## 2. Visual identity ("Midnight Ocean")

- Dark cosmic theme. Background `220 50% 8%` (deep midnight blue) with a fixed cosmic gradient (`--gradient-cosmic`) layering purple/cyan/coral/pink radial blobs plus a `.starfield` overlay (twinkling stars + drifting aurora blobs).
- Primary = coral `14 90% 60%`, secondary = warm coral `24 95% 58%`, success green, warning amber, destructive red. Sidebar `220 55% 6%`. All colors as HSL CSS vars in `src/index.css`, mirrored in `tailwind.config.ts`.
- Glass surfaces: `.glass`, `.glass-purple`, `.glass-cyan` (gradient 1px border via mask), `.glow-purple`, `.glow-cyan`. Reusable `<GlassCard variant="purple"|"cyan"|"default">`.
- Type: display = **Space Grotesk**, sans = **Inter**, mono = **JetBrains Mono**. Use `font-display` for headings, `.text-gradient-nebula` for hero accents.
- Animations: `fade-in`, `scale-in`, `float`, `pulse-glow`, `boxShake`, `twinkle`, `auroraDrift`. Radius `0.875rem`.
- Section header pattern: tiny uppercase tracked label (`text-xs uppercase tracking-[0.25em] text-secondary`) above an `H1` in `font-display text-4xl font-bold`.

## 3. Auth & onboarding

- `/auth` page: email+password sign-in/sign-up, plus **Continue with Google** via `lovable.auth.signInWithOAuth("google", …)` (Lovable Cloud managed Google — no client secret). Sign-up form collects: display name, target score (400–1600, default 1500), test date. After sign-up, upsert these onto `profiles`.
- `RequireAuth` wrapper on every route except `/auth`; `RequireAdmin` additionally gates admin pages.
- `AuthContext` exposes `{ user, session, signOut }` from Supabase auth.
- `OnboardingGate` runs once per browser session: bumps `profiles.login_count` and `last_login_at`. If `tutorial_completed=false`, shows a 6-slide **TutorialModal** (Welcome → Dashboard → Practice & Plan → Boxes/Store/Rewards → AI Coach & Weak Areas → Launch). On login #3+, if no review exists and `review_prompt_dismissed=false`, shows **ReviewPromptModal** (1–5 stars + optional comment, upsert into `reviews`).

## 4. Routes & navigation

Sidebar (desktop, `AppSidebar`) and slide-over `MobileNav` with identical items:

`Dashboard /` · `Practice /practice` · `Daily Plan /plan` · `AI Coach /coach` · `Articles /articles` · `Weak Areas /weak-areas` · `Analytics /analytics` · `Rewards /inventory` · `Boxes /boxes` · `Store /store` · `Help /help` · `Profile /profile`

Admin section (only if `user_roles.role='admin'`): `/admin/users`, `/admin/reviews`.

Test routes: `/test/:mode` where `mode ∈ {full, math, reading, redemption, review}`, plus `/coach/:slug` for individual articles. `*` → `NotFound`.

Sidebar footer shows rank card: current `XP`, `rank` name, progress bar to next rank, and Sign out button. Top of every authenticated page renders an **Active Boosts bar** (only when ≥1 live boost) showing icon, label, live countdown, and `n/3 slots`.

## 5. Data model (Lovable Cloud / Supabase)

Tables (RLS on all; users only access their own rows; admins via `has_role(uid,'admin')`):

- **profiles** `(id uuid PK = auth.users.id, display_name, target_score int, test_date date, xp int default 0, sp int default 0, streak int default 0, focus_minutes_total int default 0, inventory jsonb default '[]', active_boosts jsonb default '[]', xp_boost_until timestamptz, login_count int default 0, last_login_at timestamptz, tutorial_completed bool default false, review_prompt_dismissed bool default false, created_at, updated_at)`. `handle_new_user` trigger inserts a row on signup.
- **mistakes** `(id, user_id, section, topic, difficulty, reason ('Concept Gap'|'Time Pressure'|'Misreading'), time_spent int, prompt, passage, choices jsonb, correct_index, user_choice, explanation, created_at)`.
- **sessions** `(id, user_id, mode, score, total, duration_seconds, xp_earned, created_at)`.
- **task_completions** `(id, user_id, task_key, task_label, day_label, completed_on date, unique(user_id, task_key, completed_on))`.
- **mystery_boxes** `(id, user_id, level_number int, tier box_tier enum 'common'|'rare'|'epic'|'legendary' default 'common', upgrade_clicks_used int default 0, reward_label, reward_payload jsonb, opened_at, claimed_at, created_at, updated_at)`. FK to profiles.
- **reviews** `(id, user_id unique, rating 1–5, comment, created_at)`.
- **user_roles** `(id, user_id, role app_role enum 'admin'|'user')` — separate table to avoid privilege escalation.
- **ai_usage** `(user_id, used_on date, count int, updated_at)` — per-day per-user cap on AI generation.

Enums: `app_role`, `box_tier`. RPCs: `has_role(uid, role) security definer`, `bump_ai_usage(_user_id, _amount)` returns new count, `admin_global_stats`, `admin_user_summary`, `admin_all_reviews`.

## 6. AI question generation

Edge function `supabase/functions/generate-questions/index.ts`:

- Requires Authorization JWT; rejects anonymous calls. Per-user cap = **40 generation calls per day** enforced via `bump_ai_usage`. On overage returns 429 with a friendly message.
- Inputs: `{ mode: "full"|"math"|"reading"|"redemption", count (1–60, default 6), difficultyBias: "balanced"|"easier"|"harder", topic?: string, section?: "Math"|"Reading & Writing" }`.
- Calls **OpenRouter** (`OPENROUTER_API_KEY` secret) at `https://openrouter.ai/api/v1/chat/completions`. Splits work into batches of 8, runs sequentially with a 400 ms gap to avoid rate limits. Per batch:
  1. Try `google/gemini-2.0-flash-001` with a 22 s timeout.
  2. Fallback `meta-llama/llama-3.3-70b-instruct` with 18 s timeout.
  3. Final fallback `meta-llama/llama-3.1-8b-instruct`.
  - Retry rate-limited responses up to 2× with 1.5 s × attempt backoff before moving to the next model.
- For Math, distribute ~25% of questions as **SPR** (student-produced response) across batches; the rest multiple-choice. ELA is always multiple-choice.
- System prompt enforces: original SAT-level rigor, no copying, no chain-of-thought, every question self-contained ending in an explicit task sentence ("What is the value of x?", "Which choice best completes the text?"), exactly one correct of four choices, unicode math notation (`√ ∛ π ≤ ≥ ≠ ± ∞ ° θ Δ ² ³ · × ÷`), no LaTeX/backslash commands, no references to figures, reading passages 40–90 words at SAT complexity. Difficulty mix defaults ~20% easy / 45% medium / 35% hard, biased per request. SPR items must still provide 4 plausible numeric choices and a `correctText` string. Explanations 1–2 sentences, student-facing.
- Returns `{ questions: [...] }` with section/topic/difficulty/passage?/prompt/choices[4]/correct/responseType/correctText?/explanation. Tolerates partial batch failures and only errors if fewer than `max(4, 40%)` of requested questions were produced. Maps 401/402/429 to matching HTTP status.
- Client wrapper `src/lib/generate-questions.ts` invokes the function, strips any `<think>` tags / "reasoning:" leaks, passes everything through `sanitizeMath` (Unicode-only math normalizer in `src/lib/sanitize-math.ts`), and returns typed `Question[]`.

Topic catalogs hard-coded in the function: **Math** = Systems of Linear Equations, Quadratics, Ratios & Rates, Data Analysis, Linear Functions, Exponents & Radicals. **R&W** = Reading: Main Idea, Reading: Inference, Grammar: Subject-Verb, Vocabulary in Context, Reading: Purpose, Grammar: Punctuation.

## 7. Practice / TestSession engine (`/test/:mode`)

Modes & sizes (`MODULE_SIZE`, `MODULE_LIMIT` per mode):

- **full** = 2-section adaptive simulation: Module 1 = 54 R&W questions / 64 min, then 10-min break, then Module 2 = 44 Math / 70 min. Module 2 difficulty bias is set by Module 1 accuracy: ≥60% → "harder", else "easier". (Total ≈ 2h 14m, matching real Digital SAT.)
- **reading** = 27 R&W questions / 32 min.
- **math** = 44 Math questions / 70 min ("Math Sprint").
- **redemption** = 12 questions / 18 min, locked to one weak topic ("Weak-Skill Arena"). Topic passed via `?topic=...`.
- **review** = up to 10 questions re-played from the user's stored mistakes.

Per-question UI:
- Section + difficulty are **hidden** by default (Topic Radar buff reveals them in a toast).
- Multiple choice: 4 choices, shuffled each render with `correct` remapped. SPR: free-text input, normalized (lowercase, no whitespace) and compared to `correctText`.
- Flag toggle, Skip (records `"__skipped__"` answer + advances), per-question elapsed time tracked via `qStart` ref.
- Copy/cut/paste/contextmenu are blocked on the question pane (`no-select`) to discourage cheating.
- A `Clock` shows time **remaining** in the current module (live via a ref to avoid re-renders; state syncs every 10s).
- **Tabs** for Question / Answer Key (visible after submit).

Question-time buffs (consumed from inventory on click, max one per question instance unless noted):
- **50/50** (`fifty_fifty`): eliminate 2 random wrong choices; if current answer was eliminated, clear it. MC only.
- **Hint** (`hint`): show a one-line hint (currently surfaces explanation hook).
- **Extra Life** (`extra_life`): shield the next wrong answer from being added to the Vault (mistakes table).
- **Skip** (`skip_token`): mark question as skipped and advance.
- **Topic Radar** (`topic_radar`): toast revealing topic + difficulty.

Submit flow:
1. `gradeCurrentModule` iterates questions, counts correct, awards `xpForDifficulty` (easy 8 / medium 15 / hard 25), records mistakes for wrong non-skipped answers (reason = "Time Pressure" if >90s, else section default), respects Extra Life shield, applies XP multiplier from active boosts (`xp_3x` > `xp_2x`).
2. For `full` + module 1: snapshot answers, start 10-min break (persisted in `localStorage` so tab close survives), pre-load Module 2 in background with the biased difficulty.
3. For other modes / module 2: `recordSession` inserts a row, marks any linked daily task complete (via `?task=…&day=…` query params), and `syncProfile` re-reads from DB.
4. Done screen: correct/total, XP earned, accuracy, full **Answer Key** (passage if any, prompt, all choices marked correct/your-choice, explanation). For `full` mode, also shows the Module 1 (ELA) section in the answer key.

Error/empty states: friendly "AI is busy" toasts on rate-limit, retry button when zero questions come back.

## 8. Score engine (`src/lib/score-engine.ts`)

Pure functions producing a `ScorePrediction { total, low, high, sections, reliability }`:

1. **Adaptive threshold:** Module-1 accuracy <60% → Module 2 capped at 600; else cap 800.
2. **IRT-style weighting:** easy=10, medium=20, hard=30 points. Missing an easy question after a 5-correct streak applies a 2.5× penalty and lowers `reliability`.
3. **Drill-to-test extrapolation:** last 50 responses per section, recency ramp 0.5→1.0, difficulty influence 0.7/1.0/1.6. Ability mapped to 200–800 (anchors: 50% ≈ 500, 90% ≈ 760), capped by Module 2 cap.
4. **Confidence interval:** base width 80, shrinks with reliability; bounded by `[200, sectionCap]`.
5. **Adapter** `buildResponsesFromHistory(sessions, mistakes)` synthesises pseudo-response streams per section (mistakes → known incorrect with real difficulty; sessions → fill `score` correct responses spread across sections).
6. `predictSATScore` blends extrapolation 65% with IRT-proportion 35% per section, sums to total. Surfaced as `projectedScore`, `projectedRange` (`low–high`), and per-section bounds in `deriveNovaStats` (`src/lib/novaprep-stats.ts`).

## 9. Daily routine (`src/lib/daily-recommendations.ts`)

`buildDailyRoutine(mistakes, sessions)` returns `{ headline, subline, focus, tasks[] }` where `focus ∈ Concept Fix | Time Management | Redemption | Maintenance`. Cached in `localStorage` per day (version 4) with a signature that flips after the user completes the diagnostic set, forcing a recalibration.

Logic:
- **0 sessions** → "Build a Baseline": Math Sprint diagnostic + R&W diagnostic.
- **Only one diagnostic done** → "Complete Your Baseline": the missing diagnostic + a targeted concept drill from top mistake.
- **Both diagnostics done**: focus = Concept Fix if `conceptGap ≥ timePressure`, else Time Management. Tasks: top weak topic drill, secondary weak topic drill, optional 18-min Pacing Sprint when `timePressure>0`, optional Hard Stretch Set when last accuracy ≥85% and few mistakes. Fallback: balanced 32-min practice set.

`routeForDailyTask` builds `/test/{mode}?topic=&day=Today&task=…` so completion auto-marks the task. Surfaces on Dashboard and `/plan`.

## 10. XP, ranks, currencies, boosts (Zustand store `src/lib/novaprep-store.ts`)

- **XP** earned per question by difficulty, multiplied by live XP boost. Levels = `floor(xp/500) + 1`. Ranks (5 spans): Cadet (lvls 1–5) → Pilot (6–15) → Lieutenant (16–30) → Captain (31–50) → Commander (51–75). `rankFromXP` returns rank, next, floor, ceiling, level, levelInRank, levelsInRank.
- **SP (Study Points)** = soft currency. Earned via daily login (+25, once/day via `localStorage` key per user+date and `claimDailySP` RPC), session completion (+5 per drill), and Mystery Box drops. Spent in Store. Doubled while `sp_2x` is active.
- **Streak**: daily session streak. On load, if last session was >1 day ago AND no live `streak_freeze`, streak resets to 0.
- **Inventory** = `InventoryItem[]` jsonb. **Active boosts** = max 3 simultaneous, time-bounded by `expires_at`.

Boost kinds & categories (`BUFF_CATEGORY`):
- **Instant (auto-applied on acquisition):** `xp_2x`, `xp_3x`, `sp_2x`, `streak_freeze`. Inventory page auto-activates these on mount.
- **Activated (manual, in-test):** `fifty_fifty`, `hint`, `skip_token`, `topic_radar`, `extra_life`. Cannot be pre-activated from Inventory.

Helpers: `xpMultiplierFromBoosts`, `spMultiplierFromBoosts`, `hasLiveBoost`, `pruneExpiredBoosts` (ticks every second from the global boosts bar / Inventory page).

## 11. Mystery boxes (`/boxes`)

`syncBoxes` ensures: a free **Level 0 starter box** (tier=`rare`, label "Starter Box") plus one box per unlocked XP level (`floor(xp/500)+1`). Each box has up to 3 **upgrade taps** then opens.

- Tap upgrade chance per current tier: common→rare 30%, rare→epic 15%, epic→legendary 5%. Each tap increments `upgrade_clicks_used`. Visual feedback: upgrade flash (scale-up + ring) or `boxShake` if no upgrade.
- 4th tap opens the box. Rewards by tier (`rewardForTier`, randomized):
  - common: SP 5 / 2x XP 10 min / Hint / 50-50 / Streak Freeze.
  - rare: SP 10 / 2x XP 20 min / 50-50 / Streak Freeze / SP 20.
  - epic: SP 20 / 2x XP 30 min / 50-50 / Streak Freeze / SP 40.
  - legendary: SP 40 / 2x XP 60 min / 3x XP 30 min / 50-50 / 2x SP 30 min.
- SP rewards bank instantly (×SP multiplier); boost rewards drop into inventory.

Full-screen opening modal with starter-drop-style animation, "tap to upgrade / tap to open" prompt, and a Next/Done flow when multiple boxes are queued.

## 12. Store (`/store`)

Header: "Supply Depot" / "Store", SP counter. **Earn SP** panel with: Daily login bonus (+25, button disables after claim), Complete drills (+5, link), Open boxes (+5–40, link).

Catalog (`StoreItem[]`, tiered styling common/rare/epic):
- 2x XP · 30 min — 50 SP (common)
- 3x XP · 30 min — 120 SP (epic)
- Streak Freeze · 24h — 60 SP (rare)
- Hint · 1 use — 55 SP (common)
- 50/50 · 1 use — 70 SP (rare)
- 2x SP · 30 min — 90 SP (rare)

`buyStoreItem` deducts SP and pushes a new `InventoryItem` (with `minutes` if applicable). Toast confirms add or "Not enough SP".

## 13. Rewards / Inventory (`/inventory`)

Three blocks:
1. **Active Boosts** (max 3 slots) with live countdowns updating every second.
2. **Activated Buffs** list (cannot be pre-activated — labeled "Available in test session").
3. **Instant Buffs** list — auto-activated by an effect that loops items through `activateInventoryItem` on mount.

## 14. AI Coach (`/coach`) + Articles (`/articles`, `/coach/:slug`)

- `/coach`: "Today's Coach Note" summarising dominant error reason and count, link into Articles. Lists top 6 weak drills (mistake counts) and 6 reinforcement-topic drills (hard-coded list). Each card deep-links to `/test/redemption?topic=…`.
- `/articles`: grid of all coach articles from `coachArticles` constant (slug, title, duration, summary). Includes 10+ deep dives: Digital SAT format, every R&W question type, the four Math domains, math notation cheatsheet, comma rules, quadratics, linear systems, data & statistics, pacing math, advanced R&W traps, advanced Math tactics, etc.
- `/coach/:slug`: renders one article with `sections[]` (heading + body), back link to `/articles`.

## 15. Weak Areas (`/weak-areas`)

Builds `WeakArea[]` from mistakes grouped by topic with counts per reason and avg time. Severity = `count >=4 Critical / >=2 High / else Medium`. Cards link to `/test/redemption?topic=…`. Header KPI cards: tracked weaknesses, overall accuracy across sessions, top focus topic.

## 16. Analytics (`/analytics`)

Recharts visualizations:
- **Projected Score** line chart per session with section split (Math low–high, R&W low–high, "easy mod" marker) and reliability %.
- **Stats** card: lifetime accuracy, avg pace (s/Q), tests taken, hours logged, best accuracy, 7-session XP, strongest/weakest topic.
- **Avg Time on Weak-Area Questions** bar chart, target ≤75s.
- **Session Mix** bar chart by mode.
- **Recent Sessions** mini-list (last 5).

## 17. Profile (`/profile`)

- Hero card: gradient avatar with initials, display name, level/rank/levels-in-rank, XP, SP, gradient progress bar to next rank.
- Quick KPIs: target score, test date, lifetime accuracy, projected score.
- Editable profile form: display name, target score (400–1600), test date. Saves via `updateProfile`.
- Shortcuts to Boxes and Help.
- **Badges grid (~24 badges)** evaluated against current state: First Launch, Consistency Core (5 sessions), Iron Schedule (20), Marathon Mind (5h), Endurance Pilot (20h), Accuracy Ace 80%, Sharpshooter 90%, Perfect Drill 100%, Pace Breaker (≤75s avg), Score Climber 1300+, Elite Trajectory 1500+, Hot Streak 3d, Wildfire 7d, Unbroken 14d, SP Collector 50, SP Tycoon 250, Quartermaster (5 inv), Vault Cleaner (0 mistakes after ≥1 session), XP Pilot 2500, XP Veteran 10000, Rank Climber lvl 10, Commander Track lvl 30, Early Bird (test date set), Goal Setter (target set). Each badge has icon, title, tooltip detail; unlocked = success border, locked = dimmed.

## 18. Dashboard (`/`)

- Hero: "Welcome back, {display_name or rank}". Subline shows `routine.headline`.
- 4 KPI cards: Streak (flame), Projected score (/ target if set), Weak Areas count, XP.
- **Today's Routine** card listing each task with start/redo button. Tasks render strike-through when their `task_completions` row exists.
- **Launch a session** glow card → `/practice` ("Begin Test" / "Or run a 10-minute drill").

## 19. Practice page (`/practice`)

Grid of 4 mission cards: Full SAT Simulation (highlighted with pulse-glow), Reading & Writing Drill (32 min), Math Sprint (70 min), Weak-Skill Arena (18 min, locked to top weak topic). Each card has icon, duration chip, CTA → `/test/{mode}`.

## 20. Help (`/help`)

"Mission Briefing" page with 10 sections explaining: orientation, practice strategy, daily plan usage, focus-mode XP rule, weak areas philosophy, AI Coach articles, score range interpretation, rewards & boosts, store, profile & badges. Plus 5 power-user tips in a purple glass card.

## 21. Admin (`/admin/users`, `/admin/reviews`)

- `/admin/users`: 4 stat cards (sign-ups, total XP, sessions, avg rating) from `admin_global_stats`. Table of all users from `admin_user_summary` (name, XP, streak, logins, last login, joined).
- `/admin/reviews`: average star rating header + 2-col grid of all reviews from `admin_all_reviews`.

Access gated by `useIsAdmin` (checks `user_roles` via `has_role`).

## 22. Misc utilities

- `DataBootstrap` component: when `user` exists, calls `useNova.loadAll(user.id)` to fetch profile + mistakes (last 200) + sessions (last 100) + today's task completions + mystery boxes in parallel, then runs streak check + `syncBoxes` + `pruneExpiredBoosts`.
- `sanitize-math.ts`: forces unicode math symbols, strips LaTeX leftovers, normalizes whitespace.
- Toaster + Sonner for notifications; AlertDialog for destructive confirmations (exit during a test).
- TanStack Query provider, TooltipProvider, BrowserRouter wrap the app.

## 23. Secrets / env

- `OPENROUTER_API_KEY` (server, runtime secret) — required by `generate-questions`.
- `LOVABLE_API_KEY` (managed) — auto for any future Lovable AI use.
- Standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` env in edge functions.
- Lovable Cloud managed Google OAuth (no Google client secret in code).

## 24. Acceptance checklist

- Sign up + Google sign-in both work, profile row auto-created, target score and test date stored.
- First-time user sees Tutorial; from login 3 sees Review prompt once.
- Generating any drill: questions arrive within ~30s, with proper unicode math, 4 choices, exactly one correct, clean explanations, and SPR items only in Math.
- Full simulation: 54 ELA → 10-min break (survives reload) → 44 Math with difficulty bias derived from module 1.
- Wrong answers populate `/weak-areas` and `/analytics`. Projected score updates with a confidence range.
- Mystery boxes spawn at each XP level and tap-to-upgrade animation works.
- Store purchases deduct SP and appear in Rewards. Instant boosts auto-activate; in-test buffs work as specified.
- Streak resets after 24h gap unless a streak-freeze is live.
- Daily plan recalibrates after diagnostics and caches per day.
- Admin pages render stats and reviews only for users with `role='admin'`.
