// Post-test review: produces AI flashcards, error categorization, and concept breakdowns
// for missed questions. Uses Lovable AI Gateway.

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

type ReviewPayload = {
  missed: Missed[];
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const TIMEOUT_MS = 45_000;

function buildPrompt(missed: Missed[]) {
  const trimmed = missed.slice(0, 14).map((m, i) => ({
    n: i + 1,
    section: m.section ?? "",
    topic: m.topic ?? "",
    prompt: String(m.prompt ?? "").slice(0, 600),
    user_answer: String(m.user_answer ?? "—").slice(0, 200),
    correct_answer: String(m.correct_answer ?? "").slice(0, 200),
    explanation: String(m.explanation ?? "").slice(0, 400),
    flag: m.flag_category ?? null,
    eliminations: m.eliminations ?? {},
  }));
  return `You are an SAT coach. Given the student's MISSED questions, produce a JSON object with EXACTLY this shape and NOTHING else:
{
  "flashcards": [ {"front": "concept question (<=110 chars)", "back": "concise rule/principle (<=240 chars)"} ],
  "category_summary": [ {"category": "Concept Gap"|"Misreading"|"Time Pressure"|"Careless"|"Test Strategy", "count": number, "note": "1-sentence diagnostic"} ],
  "concept_breakdowns": [ {"topic": "topic name", "what_to_study": "3-sentence breakdown", "drills": ["short prompt 1", "short prompt 2"]} ]
}
Rules:
- 1 flashcard per missed question, max 12 total. Front = a concept stub the student should know; back = the rule/principle (not the question's specific answer).
- category_summary: include only categories that apply, sum of counts <= total missed. Use the student's flag_category and eliminations as signals.
- concept_breakdowns: 1 per UNIQUE topic, max 6. what_to_study must be 3 plain sentences explaining the concept, common pitfalls, and how to recognize it on the SAT.
- Use real Unicode math (√ π ² ³ ≤ ≥), never LaTeX. No markdown. No prose outside the JSON.

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
