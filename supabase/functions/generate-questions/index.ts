// Edge function: generate original SAT-style practice questions via OpenRouter API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOPICS_MATH = [
  "Systems of Linear Equations",
  "Quadratics",
  "Ratios & Rates",
  "Data Analysis",
  "Linear Functions",
  "Exponents & Radicals",
];
const TOPICS_RW = [
  "Reading: Main Idea",
  "Reading: Inference",
  "Grammar: Subject-Verb",
  "Vocabulary in Context",
  "Reading: Purpose",
  "Grammar: Punctuation",
];

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BATCH_SIZE = 8;
const PRIMARY_BATCH_TIMEOUT_MS = 22_000;
const FALLBACK_BATCH_TIMEOUT_MS = 18_000;
// Sequential batches to avoid OpenRouter per-second rate limits
const BATCH_CONCURRENCY = 1;
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type DifficultyBias = "balanced" | "easier" | "harder";
type SectionName = "Math" | "Reading & Writing";
type ResponseType = "multiple-choice" | "spr";

type GeneratedQuestion = {
  section: SectionName;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  passage?: string;
  prompt: string;
  choices: string[];
  correct: number;
  responseType: ResponseType;
  correctText?: string;
  explanation: string;
};

const responseFormatInstruction =
  "Return only polished final questions through the tool. Use actual newline characters for multi-line math or passages, never escaped literal \\n text.";

function buildSystemPrompt() {
  return `You are an expert SAT tutor creating ORIGINAL SAT-level practice questions only. Never create below-SAT difficulty items, never copy from official material, and never reveal hidden reasoning, chain-of-thought, self-reflection, or internal notes. Topics for Math: ${TOPICS_MATH.join(", ")}. Topics for Reading & Writing: ${TOPICS_RW.join(", ")}. Reading questions must include a short original passage (40-90 words) at authentic SAT complexity (college-prep vocabulary, dense syntax, nuanced argument). Reading & Writing questions must be multiple-choice (responseType="multiple-choice"). Math questions use a mix of multiple-choice and student-produced response (responseType="spr"); every SPR item must also include a concise correctText answer (a number, fraction like 3/4, or decimal). CRITICAL CLARITY RULES: every question must be 100% self-contained, unambiguous, grammatical, and answerable from the prompt and (if present) the passage alone. The prompt MUST end with a clear, explicit task sentence such as "What is the value of x?" or "Which choice best completes the text?" — never leave the student guessing what to find. Never reference figures, charts, images, tables, or external context. Never ask "select all that apply" — exactly one of the four choices must be correct. MATH NOTATION: use real Unicode symbols, NOT letters or LaTeX. Use √ for square root (e.g. √2, √(x+1)), ∛ for cube root, π for pi, ≤ ≥ ≠ ± ∞ ° θ Δ, superscripts ² ³ for small powers (e.g. x² + 3x − 4), · or × for multiplication, ÷ for division, fractions as a/b. Do NOT write "sqrt(", "pi", "<=", ">=", "!=", "\\frac", "\\sqrt", "$", or any backslash commands. ELA RIGOR: include real SAT-level vocabulary, multi-clause inference, evidence-pairing, and transitions where the wrong answers are highly plausible. Re-read each question and confirm a typical SAT student would understand exactly what is being asked. Double-check that exactly one choice is correct and matches the indicated correct index. Explanations: 1-2 sentences, student-facing, final only.`;
}

function buildUserPrompt(opts: {
  count: number;
  difficultyBias: DifficultyBias;
  mode: string;
  section?: SectionName;
  topic?: string;
  batchIndex: number;
  batchCount: number;
  sprCount: number;
}) {
  const { count, difficultyBias, mode, section, topic, batchIndex, batchCount, sprCount } = opts;
  let sectionInstruction = "Mix sections roughly evenly between 'Math' and 'Reading & Writing'.";
  if (section === "Math") sectionInstruction = "Section must be exactly 'Math'.";
  else if (section === "Reading & Writing") sectionInstruction = "Section must be exactly 'Reading & Writing'.";
  else if (mode === "math") sectionInstruction = "Section must be exactly 'Math'.";
  else if (mode === "reading") sectionInstruction = "Section must be exactly 'Reading & Writing'.";
  else if (mode === "redemption") sectionInstruction = "Use the section that best fits the target topic.";

  let diffInstruction = "Use roughly 20% easy, 45% medium, 35% hard. ELA must include challenging inference and rhetorical synthesis items at real SAT difficulty — never trivially easy.";
  if (difficultyBias === "harder") diffInstruction = "Skew HEAVILY toward 'hard' (about 60% hard, 30% medium, 10% easy). Hard questions should require multi-step reasoning, hidden traps, or compound skills.";
  else if (difficultyBias === "easier") diffInstruction = "Skew toward 'medium' with some 'easy'.";

  const topicInstruction = topic ? `Focus every question on this skill/topic: ${topic}.` : "Vary topics across the allowed SAT skills.";
  const mathMixInstruction = section === "Math" || mode === "math"
    ? `For this batch, return exactly ${sprCount} student-produced response questions and exactly ${count - sprCount} multiple-choice questions.`
    : "All questions in this batch must be multiple-choice.";

  return `Generate ${count} original SAT-style questions for batch ${batchIndex + 1} of ${batchCount}. ${sectionInstruction} ${diffInstruction} ${topicInstruction} ${mathMixInstruction} Avoid repeating the same setup, wording, passage pattern, or answer pattern within this batch or across batches. Make the topics, numbers, rhetorical situations, and distractor logic feel meaningfully different from one another. ${responseFormatInstruction}`;
}

async function requestQuestionBatch(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model: string;
  timeoutMs?: number;
}) {
  const { apiKey, systemPrompt, userPrompt, model, timeoutMs = PRIMARY_BATCH_TIMEOUT_MS } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("AI batch timed out"), timeoutMs);

  try {
    const aiResp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\nOUTPUT FORMAT: Respond with ONLY a valid JSON object (no prose, no markdown fences) of the exact shape: {"questions":[ {"section":"Math"|"Reading & Writing","topic":string,"difficulty":"easy"|"medium"|"hard","passage":string?,"prompt":string,"choices":[string,string,string,string],"correct":0|1|2|3,"responseType":"multiple-choice"|"spr","correctText":string?,"explanation":string} ]}. EVERY question MUST include all 4 choices and a correct index 0-3 — even SPR questions must still provide 4 plausible numeric choices with the correct one at index "correct" AND a correctText field. Never omit choices. Never add fields outside this schema.`,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (aiResp.status === 429) return { retryable: true as const, rateLimited: true as const, error: "Rate limits exceeded, please try again shortly." };
    if (aiResp.status === 401 || aiResp.status === 403) return { retryable: false as const, error: "AI provider authentication failed." };
    if (aiResp.status === 402) return { retryable: false as const, error: "AI credits exhausted. Add funds to your Lovable workspace in Settings → Workspace → Usage." };
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      return { retryable: true as const, error: "AI gateway error" };
    }

    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { retryable: true as const, error: "No content returned" };
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return { retryable: true as const, error: "Invalid JSON returned" };
      parsed = JSON.parse(match[0]);
    }
    const questions = (parsed?.questions ?? []) as GeneratedQuestion[];
    // Defensive: filter out any malformed entries instead of failing the whole batch
    const valid = questions.filter(
      (q) =>
        q && q.section && q.prompt && Array.isArray(q.choices) && q.choices.length === 4 &&
        Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3 && q.explanation,
    );
    if (!valid.length) return { retryable: true as const, error: "No valid questions returned" };
    return { retryable: false as const, questions: valid };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("AI batch timed out; will retry with fallback model");
      return { retryable: true as const, error: "AI batch timed out" };
    }
    console.error("AI batch request failed", error);
    return { retryable: true as const, error: error instanceof Error ? error.message : "AI request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateBatchWithFallback(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const attempts = [
    { model: "google/gemini-2.0-flash-001", timeoutMs: PRIMARY_BATCH_TIMEOUT_MS, suffix: "" },
    { model: "meta-llama/llama-3.3-70b-instruct", timeoutMs: FALLBACK_BATCH_TIMEOUT_MS, suffix: " Keep wording concise but maintain full SAT-level correctness and rigor." },
    { model: "meta-llama/llama-3.1-8b-instruct", timeoutMs: FALLBACK_BATCH_TIMEOUT_MS, suffix: " Output ONLY valid JSON matching the schema exactly. Do not add commentary." },
  ] as const;

  let lastError = "AI gateway error";
  for (const attempt of attempts) {
    for (let tryNum = 0; tryNum <= RATE_LIMIT_RETRIES; tryNum++) {
      const result = await requestQuestionBatch({
        ...params,
        model: attempt.model,
        timeoutMs: attempt.timeoutMs,
        userPrompt: `${params.userPrompt}${attempt.suffix}`,
      });
      if ("questions" in result) return result.questions;
      lastError = result.error;
      // Retry rate limits with backoff before moving to next model
      if ("rateLimited" in result && result.rateLimited && tryNum < RATE_LIMIT_RETRIES) {
        await sleep(RATE_LIMIT_BACKOFF_MS * (tryNum + 1));
        continue;
      }
      if (!result.retryable) throw new Error(result.error);
      break; // try next model
    }
  }

  throw new Error(lastError);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function distributeMathSpr(totalCount: number, batchCount: number) {
  const targetSpr = Math.round(totalCount * 0.25);
  const perBatch = Array.from({ length: batchCount }, (_, i) => {
    const start = Math.floor((targetSpr * i) / batchCount);
    const end = Math.floor((targetSpr * (i + 1)) / batchCount);
    return end - start;
  });
  return perBatch;
}

// Per-user daily generation cap (each call counts as 1, regardless of question count)
const DAILY_CALL_CAP = 40;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawCount = Number(body.count);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.min(Math.floor(rawCount), 60) : 6;
    const allowedModes = new Set(["full", "math", "reading", "redemption"]);
    const mode = allowedModes.has(body.mode) ? body.mode : "full";
    const allowedBias = new Set(["balanced", "easier", "harder"]);
    const difficultyBias = allowedBias.has(body.difficultyBias) ? body.difficultyBias : "balanced";
    const allowedSections = new Set(["Math", "Reading & Writing"]);
    const section = allowedSections.has(body.section) ? body.section : undefined;
    const topic = typeof body.topic === "string" ? body.topic.slice(0, 200) : undefined;

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    // ------- Mandatory auth + per-user daily cap -------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt || !SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (authErr || !uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: bumped, error: bumpErr } = await userClient.rpc("bump_ai_usage", {
      _user_id: uid,
      _amount: 1,
    });
    if (!bumpErr && typeof bumped === "number" && bumped > DAILY_CALL_CAP) {
      return new Response(
        JSON.stringify({
          error:
            "Daily AI generation limit reached. Try again tomorrow — this cap keeps free AI credits available for everyone.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const effectiveSection: SectionName | undefined =
      section ?? (mode === "math" ? "Math" : mode === "reading" ? "Reading & Writing" : undefined);
    const batchSizes: number[] = [];
    for (let remaining = count; remaining > 0; remaining -= BATCH_SIZE) {
      batchSizes.push(Math.min(BATCH_SIZE, remaining));
    }
    const sprDistribution = effectiveSection === "Math" || mode === "math"
      ? distributeMathSpr(count, batchSizes.length)
      : batchSizes.map(() => 0);

    const systemPrompt = buildSystemPrompt();
    const collected: GeneratedQuestion[] = [];
    const batchErrors: string[] = [];
    // Run sequentially to avoid OpenRouter rate limits, with small inter-batch
    // delay. Tolerate individual batch failures and return whatever we got.
    for (let batchIndex = 0; batchIndex < batchSizes.length; batchIndex++) {
      const batchCount = batchSizes[batchIndex];
      try {
        const qs = await generateBatchWithFallback({
          apiKey: OPENROUTER_API_KEY,
          systemPrompt,
          userPrompt: buildUserPrompt({
            count: batchCount,
            difficultyBias,
            mode,
            section: effectiveSection,
            topic,
            batchIndex,
            batchCount: batchSizes.length,
            sprCount: sprDistribution[batchIndex] ?? 0,
          }),
        });
        collected.push(...qs);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Batch failed";
        console.error(`Batch ${batchIndex + 1}/${batchSizes.length} failed:`, message);
        batchErrors.push(message);
        // Hard-stop only on auth/credit failures — those won't recover
        if (/authentication failed|credits exhausted/i.test(message)) {
          if (collected.length === 0) {
            const status = /credits exhausted/i.test(message) ? 402 : 401;
            return new Response(JSON.stringify({ error: message }), {
              status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          break;
        }
      }
      // Brief pause between batches to ease provider rate limiting
      if (batchIndex < batchSizes.length - 1) await sleep(400);
    }

    const questions = collected.slice(0, count);
    // Require at least a usable minimum so the session isn't stuck on 1 question
    const minUsable = Math.min(count, Math.max(4, Math.floor(count * 0.4)));
    if (questions.length < minUsable) {
      const message = batchErrors[0] ?? "Question generation returned too few questions.";
      const status = /Rate limits exceeded/i.test(message) ? 429 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
