# Fix pass: drills, sync, review depth, Buddy leveling, login redesign

## 1. Drill completion CTA
- In `TestSession.tsx`, only show the "Continue to next module" button when `mode === "test"` (full SAT) — never after a `drill`.

## 2. Remove AI pins
- Sweep UI for "AI" badges/chips/pins (sidebar, mobile nav, cards, headers). Remove the visual pin/badge but leave AI features working.

## 3. Sync (cloud, not just local)
- Audit `novaprep-store.ts`: every mutation (recordSession, updateProfile, mistake add, task completion, annotations) must write to Supabase before/alongside local state. Fix any that only update Zustand.
- Verify RLS + grants on `sessions`, `mistakes`, `profiles`, `question_annotations`, `task_completions`. Add missing grants if the read query shows gaps.
- Admin pages (`admin/Users.tsx`, `admin/Reviews.tsx`): confirm they call `admin_user_summary` and `admin_all_reviews` RPCs and render `login_count`, `last_login_at`, session totals. Fix rendering if fields are missing.
- Ensure `record_login_and_get_onboarding` is called on every sign-in so login counts populate.

## 4. Post-Test Review Dashboard — richer explanations
- Update `supabase/functions/post-test-review/index.ts` prompt so per-question explanations include:
  - Why the correct answer is right
  - Why each *tempting/close* distractor is wrong (trap type)
  - Specifically why the user's chosen answer failed
  - A "how to avoid this next time" tip
- Update `PostTestReview.tsx` Answer Key tab to render these sections per question (correct rationale, distractor breakdown, user-choice diagnosis, fix-it tip).

## 5. Better flashcards
- Same edge function: flashcards get `concept`, `full_explanation`, `worked_example`, `common_pitfalls`, `memory_hook` — not just concept + solve steps.
- Update the flip-card back face to render the fuller layout.

## 6. Buddy pet leveling + XP donation
- **DB migration**: add `pet_xp int default 0`, `pet_level int default 1` to `profiles`. Add RPC `donate_xp_to_pet(_xp int)` that moves 25% of a given XP amount from user to pet, recomputes pet level using scaling curve `xp_needed(level) = 100 * level^1.6`, returns new state.
- **Session flow**: after finishing a drill/module/test, prompt "Donate 25% XP to Buddy?" (Yes/No). Yes → call RPC; No → keep all XP.
- **Buffs by pet level** (only active when `pet_energy >= 75`, i.e., Joyful/Awake):
  - L3: +5% XP
  - L5: +5% SP
  - L8: +1 treat per session
  - L12: +10% XP
  - L20: +15% XP & +10% SP
- Update `record_session_rewards` to add these on top of cosmetic buffs when energy ≥ 75 and pet_level ≥ threshold.
- Show Buddy's level, xp bar, and active buffs on `Pet.tsx`.

## 7. MC question formatting
- In `TestSession.tsx` / question renderer: strip inline `(A) ... (B) ...` from the question stem, render the four choices as separate labeled options with A/B/C/D on the side. Update `generate-questions` prompt if it's producing inline choices.

## 8. Login page redesign
- Split-screen layout in `Auth.tsx`: form on the **left**, marketing panel on the **right** with Buddy illustration + rotating slogan/quote, same purple/cyan theme. Keep all existing auth logic (email/pw, Google OAuth, signup fields).

## Out of scope
- Bluebook visual overhaul, new AI providers, new pages beyond the auth redesign.

## Confirm before I build
Reply "go" and I'll execute all 8 in one pass (DB migration first, then code). If any item should be dropped or narrowed, say which.
