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

export async function generateQuestions(opts: GenerateOptions): Promise<Question[]> {
  const { data, error } = await supabase.functions.invoke("generate-questions", {
    body: opts,
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
      id: `${Date.now()}-${i}`,
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
