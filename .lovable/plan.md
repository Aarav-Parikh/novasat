# Fix "AI request failed" when generating questions

## What's happening now

The question generator no longer gets rejected for the key or the plan — that part is fixed. The current logs (04:31 UTC) show a different failure: every batch is being cut off for taking too long ("AI batch timed out"), so the app reports a 500.

The reason is that the account can only use the smaller, slower Mistral models (the log lists small/ministral/codestral models only — no medium or large). The generator still asks each request to write 10 full SAT questions in one go and gives it only 22 seconds. The small models can't finish that in time, so every attempt is aborted.

## The fix

1. Ask for fewer questions per request (about 4 instead of 10) so each request finishes well inside the time limit.
2. Give each request more time (roughly 45 seconds primary, 35 seconds for retries) and cap the response length to a realistic size instead of 8000 tokens.
3. Run a couple of these smaller requests side by side so a full drill still arrives quickly.
4. Point the retry list at models the account actually has (mistral-small, ministral-14b, ministral-8b) and drop the medium/large names that will never work here, keeping the existing "pick any available chat model" safety net.
5. If one small request still fails but the others succeed, top up with one quick extra request rather than failing the whole drill; only show an error if there genuinely aren't enough questions.
6. Keep the user informed: a clear, plain-language message if generation truly fails, instead of "AI request failed".

## Verification

Call the generator directly for both a Math drill and a Reading & Writing drill, confirm a 200 with the full requested number of questions, then re-check the function logs for any remaining timeouts.

## Technical notes

All changes are in `supabase/functions/generate-questions/index.ts`: `BATCH_SIZE`, `PRIMARY_BATCH_TIMEOUT_MS`, `FALLBACK_BATCH_TIMEOUT_MS`, `max_tokens`, the fallback model candidate list, and the batch-failure handling around `mapWithConcurrency`. Redeploy the function afterwards.
