# Fix question generation (Mistral key rejected)

## What's happening

The question generator calls Mistral with your own API key. Mistral is currently
rejecting that key, so every generation attempt fails with "AI provider
authentication failed" and no questions come back. The app code is fine — the
key is the problem.

## Fix

1. Ask you for a fresh Mistral API key and store it securely as `MISTRAL_API_KEY`
   (replacing the current value).
2. Run one live generation through the question function and read the response to
   confirm real questions come back — not just that it deployed.
3. If Mistral answers with a credit/quota error instead of an auth error, report
   that back to you rather than guessing.

## Also worth improving

Right now a key failure shows up only as a vague failure in the app. I'll make the
practice screens show a clear message ("AI question service is unavailable —
check the API key") so this is obvious next time instead of silent.

## Technical notes

- Secret name: `MISTRAL_API_KEY`, read in `supabase/functions/generate-questions/index.ts`.
- No model, prompt, or grading logic changes.
- Verification: invoke `generate-questions` with a small math drill request and
  inspect the returned payload and function logs.
