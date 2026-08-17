// Post-test review: produces AI flashcards, error categorization, per-question deep analysis,
// and concept breakdowns for missed questions. Uses Lovable AI Gateway.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Missed = {
  question_id: string;
  section?: string;
  topic?: string;
  prompt: string;
  user_answer?: string;
  correct_answer?: string;
  explanation?: string;
  flag_category?: string | null;
  eliminations?: Record<string, string>;
};

type Part = "insights" | "study";
type ReviewPayload = { missed: Missed[]; part?: Part };

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const TIMEOUT_MS = 55_000;

function buildPrompt(missed: Missed[], part: Part | undefined) {
  const trimmed = missed.slice(0, 14).map((m, i) => ({
    n: i + 1,
    question_id: m.question_id,
    section: m.section ?? "",
    topic: m.topic ?? "",
    prompt: String(m.prompt ?? "").slice(0, 900),
    user_answer: String(m.user_answer ?? "—").slice(0, 240),
    correct_answer: String(m.correct_answer ?? "").slice(0, 240),
    explanation: String(m.explanation ?? "").slice(0, 500),
    flag: m.flag_category ?? null,
    eliminations: m.eliminations ?? {},
  }));
  const studyShape = `  "flashcards": [
    {
      "front": "concept question (<=110 chars)",
      "concept": "the exact concept/rule being tested (<=140 chars)",
      "full_explanation": "3-5 sentence explanation of the rule/principle in student-friendly language",
      "worked_example": "one concrete worked example showing the rule in action (<=280 chars)",
      "common_pitfalls": "1-2 sentences on the most common wrong reasoning",
      "memory_hook": "a short mnemonic, phrase, or visual to help remember (<=120 chars)"
    }
  ],
  "category_summary": [
    { "category": "Concept Gap"|"Misreading"|"Time Pressure"|"Careless"|"Test Strategy", "count": number, "note": "1-sentence diagnostic" }
  ],
  "concept_breakdowns": [
    { "topic": "topic name", "what_to_study": "3-sentence breakdown of the concept, pitfalls, and how it shows up on the SAT", "drills": ["short prompt 1", "short prompt 2"] }
  ]`;

  const insightShape = `  "answer_insights": [
    {
      "question_id": "matches input question_id",
      "why_correct": "2-3 sentences explaining precisely WHY the correct answer is right",
      "why_user_wrong": "2-3 sentences explaining specifically why the user's chosen answer is wrong (or 'Skipped/blank' if empty)",
      "distractor_traps": "1-3 sentences on which of the other choices are the closest/most tempting and the specific trap type (e.g., swapped variable, opposite tone, out-of-scope, off-by-one, verb tense mismatch)",
      "fix_it_tip": "1-2 sentence actionable strategy to avoid this mistake next time",
      "underlying_pattern": "2-3 sentences naming the recurring SAT pattern/question archetype behind this item and how to recognize it instantly next time",
      "shortcut": "a concrete faster route: plugging in numbers, elimination heuristic, structure clue, or algebraic shortcut (<=240 chars)"
    }
  ]`;

  const shape =
    part === "study" ? studyShape : part === "insights" ? insightShape : `${studyShape},\n${insightShape}`;

  const rules = [
    part === "insights"
      ? "- answer_insights: exactly one entry per missed question, keyed by the input question_id. Do NOT invent question_ids."
      : "- 1 flashcard per unique concept in the missed set, max 10.",
    "- Use real Unicode math (√ π ² ³ ≤ ≥), never LaTeX. No markdown. No prose outside the JSON.",
    part === "insights"
      ? "- ALWAYS fill underlying_pattern and shortcut: students need the repeatable pattern and the fast trick.\n- Be blunt about what tempting answers look like — students learn from concrete trap-spotting.\n- Be dense but efficient: no filler sentences."
      : "- Keep every field tight and concrete — no filler sentences.",
  ].join("\n");

  return `You are an elite SAT tutor. For each MISSED question, produce a rich diagnostic. Return a single JSON object with this EXACT shape and NOTHING else:

{
${shape}
}

Rules:
${rules}

MISSED QUESTIONS:
${JSON.stringify(trimmed)}`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json()) as ReviewPayload;
    if (!body || !Array.isArray(body.missed) || body.missed.length === 0) {
      return new Response(JSON.stringify({
        flashcards: [],
        category_summary: [],
        concept_breakdowns: [],
        answer_insights: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort("review timed out"), TIMEOUT_MS);

    let aiResp: Response;
    try {
      aiResp = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "Return only valid JSON. No prose, no markdown fences." },
            { role: "user", content: buildPrompt(body.missed) },
          ],
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      });
    } finally {
      clearTimeout(t);
    }

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "AI is busy, try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("review gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "Review generation failed." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try { parsed = JSON.parse(content.slice(start, end + 1)); } catch {}
      }
    }
    const out = {
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards.slice(0, 12) : [],
      category_summary: Array.isArray(parsed.category_summary) ? parsed.category_summary.slice(0, 6) : [],
      concept_breakdowns: Array.isArray(parsed.concept_breakdowns) ? parsed.concept_breakdowns.slice(0, 6) : [],
      answer_insights: Array.isArray(parsed.answer_insights) ? parsed.answer_insights.slice(0, 20) : [],
    };
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("post-test-review error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
