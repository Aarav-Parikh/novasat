## 1. Post-Test Review Dashboard (all modes)

Replaces the current "Mission Complete" screen for tests + drills (kept simple for `review` mistake-loop mode).

**New section under the results screen:**
- **AI Flashcards**: For each missed question, generate a flashcard (front: a concept/question stub, back: rule + worked principle). Generated on-demand from a new edge function `post-test-review` using Lovable AI Gateway (`google/gemini-3-flash-preview`). Flashcards exposed as a flip-card carousel.
- **Error Categorization**: Auto-buckets missed questions into Concept Gap / Misreading / Time Pressure / Careless using the same `ErrorReason` already recorded, plus the user's flag tag and eliminator tags as signals. Shows a bar chart of mistake counts per category.
- **Concept Breakdowns**: For each missed question's topic, AI produces a short "what to study" paragraph (~3 sentences) + 2 practice prompts to attack the weakness.

Everything is post-submit only. The active testing UI is untouched. No AI hints, no pop-ups during the test.

## 2. Reason-Tagged Option Eliminator (required tag)

In the test interface, long-press / right-click / click an "X" affordance on a multiple-choice option to cross it out. A small popover **blocks** the strikethrough until the user picks a tag:
- Out of Scope
- Too Extreme
- Factually Faulty
- Contradicts Passage
- Other (free text)

The crossed-out option is visually struck through and dimmed. The app never reveals whether the elimination was correct. Tags are stored per-question and surfaced in the new Review Dashboard (e.g. "On 3 misses you eliminated the correct answer as 'Too Extreme'").

## 3. Adaptive Pacing Timer (Full SAT modules only, setting toggle)

- Applies to `full` and `shortfull` modes only.
- New setting in Profile: `adaptive_pacing_enabled` (default ON, stored on `profiles`).
- Compute expected pace = `currentLimit * (idx+1) / questions.length`.
  - Within ±10s of expected → **green** ring on the timer.
  - Behind by >30s → **red**.
  - In between → **yellow**.
- **Fade-out**: After the user's 3rd completed full/short SAT module, color cues disappear permanently (just a normal mono countdown).
- The exact target pace number is never shown — only the color.
- Counter stored on `profiles.full_sat_pacing_uses`.

## 4. Categorized Review Flag (hotkey sub-categories)

When the user taps "Flag", a small inline picker appears with hotkeys 1–5:
1. 50/50 Guess
2. Completely Stuck
3. Ran out of time
4. Careless / Silly
5. Other (free-text input)

The picker is required to complete the flag. Question layout is unchanged, no hints given. Flag category is stored alongside the flag.

On the pre-submit review grid, each flagged question's number tile shows its sub-category label underneath.

In the new Review Dashboard, flag categories appear next to missed/flagged questions.

---

## Technical notes

**Database (migration):**
- `profiles`: add `adaptive_pacing_enabled boolean default true`, `full_sat_pacing_uses int default 0`.
- New table `question_annotations` (per-question, per-session): `session_id`, `user_id`, `question_id`, `flag_category text`, `flag_note text`, `eliminations jsonb` (`{choiceIndex: tagString}`). RLS owner-only. GRANTs to authenticated + service_role. Created via the migration tool.
- RPC `increment_pacing_uses()` to bump the counter atomically.

**Edge function:**
- `supabase/functions/post-test-review/index.ts` — accepts missed questions, returns `{ flashcards[], categorySummary, conceptBreakdowns[] }` as structured output.

**Frontend files:**
- `src/pages/TestSession.tsx` — add eliminator UI on choices, flag-category picker, adaptive pacing ring (full only), persist annotations on submit, post-submit dashboard.
- `src/components/PostTestReview.tsx` (new) — Flashcards carousel + category chart + breakdowns.
- `src/components/ChoiceEliminator.tsx` (new) — popover for eliminator tag.
- `src/components/FlagCategoryPicker.tsx` (new) — flag tagger.
- `src/pages/Profile.tsx` — add adaptive pacing toggle.
- `src/lib/novaprep-store.ts` — saveAnnotations, fetchAnnotations, updatePacingSetting helpers.

**Out of scope** (will not touch unless you ask):
- Bluebook visual style — no changes to the live test UI beyond adding the small "X" affordance on each choice and the inline flag category picker.
- The `review` (mistake redo) mode keeps its current simple completion screen.
