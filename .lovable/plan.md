# Fix: questions marked with the wrong "correct" answer

## What's happening

Questions are written by a smaller, faster AI model. That model sometimes picks a
letter that doesn't match the answer it actually reasoned out. Nothing today checks
whether the marked answer is truly right — the current checks only make sure the
marked letter and the marked answer text agree with each other, not that either is
correct. Later, the review step uses a stronger model, which solves the question
properly, notices the mismatch, and writes a long "this was actually wrong"
explanation. That's the paragraph you're seeing.

## The fix: an answer-check pass before questions reach you

After a batch of questions is written and before it is handed to the student,
run a second, independent solve of each question:

1. The checker gets only the question, the passage (if any), and the four choices —
   never the proposed answer, so it can't be biased.
2. Its answer is compared to the marked one.
   - Agree: the question ships.
   - Disagree: the marked answer is corrected to the checker's answer and its
     explanation is rewritten to match, or the question is dropped if the checker
     is unsure or finds more than one defensible choice.
3. Questions whose written explanation argues for a different choice than the marked
   one are also dropped — that inconsistency is the exact symptom you described.

Because a few items can be dropped, the generator tops up the set so you still get
the number of questions you asked for.

## Speed

The check runs in parallel with the same small-batch approach already used for
generation, so it adds a few seconds rather than doubling the wait. Time budgets
stay inside the existing limits, and if the checker itself times out the question
set is still delivered (unchecked rather than blocked), so this can never break a
test session.

## Also cleaned up

In the post-test review, when an answer key is corrected the explanation should teach
the concept, not narrate the grader's disagreement. The review prompt will be told to
explain the correct answer directly and skip meta-commentary about faulty answer keys.

## Technical detail

- `supabase/functions/generate-questions/index.ts`
  - New `verifyBatch()` helper: one AI call per group of ~4 questions, JSON out:
    `{id, answer_letter, confidence: "high"|"low", single_correct: boolean}`.
  - Verification runs after `sanitizeGeneratedQuestion` and before the section/topic
    locks; low confidence, `single_correct: false`, or an unparseable reply drops the item.
  - On disagreement with high confidence: re-point `correct`/`correctText` and request a
    one-sentence replacement explanation in the same verify response.
  - Reuse `mapWithConcurrency`, existing model fallback list, and a shorter timeout
    (~20s); on verifier failure, pass questions through unverified and log it.
  - Existing top-up pass extended to cover verification drops.
- `supabase/functions/post-test-review/index.ts`: prompt rule added — explain the correct
  answer directly, never comment on the quality or correctness of the answer key.
