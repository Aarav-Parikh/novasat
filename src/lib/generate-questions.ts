import { supabase } from "@/integrations/supabase/client";
import { Question } from "./novaprep-data";
import { sanitizeMath } from "./sanitize-math";

export interface GenerateOptions {
  mode: "full" | "math" | "reading" | "redemption";
  count?: number;
  difficultyBias?: "balanced" | "easier" | "harder";
  topic?: string;
  section?: "Math" | "Reading & Writing";
}

const clean = (text?: string) =>
  sanitizeMath(
    (text ?? "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/(^|\n)\s*(reasoning|chain of thought|internal thinking)\s*:[\s\S]*/gi, ""),
  ).trim();

const normalizeAnswerText = (text?: string) => clean(text).toLowerCase().replace(/\s+/g, " ");

// Each edge-function call must finish well inside the 150s gateway idle limit,
// so large sets (full simulations) are split into small parallel requests.
const CHUNK_SIZE = 12;
const CHUNK_CONCURRENCY = 3;

async function runChunks<T>(counts: number[], worker: (n: number, i: number) => Promise<T[]>) {
  const out: T[][] = new Array(counts.length).fill(null).map(() => []);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CHUNK_CONCURRENCY, counts.length) }, async () => {
    while (cursor < counts.length) {
      const i = cursor++;
      try {
        out[i] = await worker(counts[i], i);
      } catch (e) {
        out[i] = [];
        if (i === 0 && counts.length === 1) throw e;
      }
    }
  });
  await Promise.all(runners);
  return out.flat();
}

export async function generateQuestions(opts: GenerateOptions): Promise<Question[]> {
  const total = opts.count ?? 6;
  if (total > CHUNK_SIZE) {
    const counts: number[] = [];
    for (let remaining = total; remaining > 0; remaining -= CHUNK_SIZE) {
      counts.push(Math.min(CHUNK_SIZE, remaining));
    }
    const all = await runChunks(counts, (n) => generateQuestions({ ...opts, count: n }));
    if (all.length === 0) throw new Error("We couldn't build this question set. Please try again in a moment.");
    const seen = new Set<string>();
    return all.filter((q) => {
      const key = q.prompt.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const { data, error } = await supabase.functions.invoke("generate-questions", {
    body: { ...opts, count: total },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  const raw = (data as any)?.questions ?? [];
  return raw.map((q: any, i: number): Question => {
    const section = q.section === "Math" ? "Math" : "Reading & Writing";
    const rawType = q.responseType ?? q.response_type;
    const responseType = rawType === "spr" ? "spr" : "multiple-choice";
    const choices = Array.isArray(q.choices) && q.choices.length === 4 ? q.choices.map(clean) : ["", "", "", ""];
    const boundedCorrect = Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3 ? q.correct : 0;
    const providedCorrectText = clean(q.correctText ?? q.correct_text ?? q.correct_answer);
    const matchingIndex = providedCorrectText
      ? choices.findIndex((choice) => normalizeAnswerText(choice) === normalizeAnswerText(providedCorrectText))
      : -1;
    const correct = responseType === "multiple-choice" && matchingIndex >= 0 ? matchingIndex : boundedCorrect;
    if (responseType === "multiple-choice" && providedCorrectText && matchingIndex < 0) choices[correct] = providedCorrectText;
    if (responseType === "spr" && providedCorrectText && !choices.some((choice) => normalizeAnswerText(choice) === normalizeAnswerText(providedCorrectText))) choices[correct] = providedCorrectText;
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
      section,
      topic: q.topic,
      difficulty: q.difficulty,
      prompt: clean(q.prompt),
      passage: clean(q.passage) || undefined,
      choices,
      correct,
      correctText: providedCorrectText || choices[correct],
      responseType: responseType === "spr" ? "spr" : "multiple-choice",
      explanation: clean(q.explanation),
    };
  });
}
