// Type definitions and helpers — no mock content. All practice questions are
// generated live by the `generate-questions` edge function.

export type Difficulty = "easy" | "medium" | "hard";
export type ErrorReason = "Concept Gap" | "Time Pressure" | "Misreading";
export type Section = "Math" | "Reading & Writing";
export type ResponseType = "multiple-choice" | "spr";

export interface Question {
  id: string;
  section: Section;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  passage?: string;
  choices: string[];
  correct: number;
  correctText?: string;
  responseType?: ResponseType;
  explanation: string;
}

export interface MistakeRecord {
  id: string;
  user_id: string;
  section: string;
  topic: string;
  difficulty: Difficulty;
  reason: ErrorReason;
  time_spent: number;
  prompt: string;
  passage: string | null;
  choices: string[];
  correct_index: number;
  user_choice: number | null;
  explanation: string | null;
  created_at: string;
}

export const RANKS = ["Cadet", "Pilot", "Lieutenant", "Captain", "Commander"] as const;

const RANK_SPANS = [5, 10, 15, 20, 25] as const;

export function rankFromXP(xp: number) {
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  let cumulative = 0;

  for (let i = 0; i < RANKS.length; i += 1) {
    const span = RANK_SPANS[i];
    const startLevel = cumulative + 1;
    const endLevel = cumulative + span;
    if (level <= endLevel || i === RANKS.length - 1) {
      const levelInRank = Math.min(span, Math.max(1, level - cumulative));
      const floor = cumulative * 500;
      const ceiling = endLevel * 500;
      return {
        rank: RANKS[i],
        next: RANKS[Math.min(i + 1, RANKS.length - 1)],
        floor,
        ceiling,
        level,
        levelInRank,
        levelsInRank: span,
        startLevel,
        endLevel,
      };
    }
    cumulative += span;
  }

  return {
    rank: RANKS[RANKS.length - 1],
    next: RANKS[RANKS.length - 1],
    floor: 0,
    ceiling: 500,
    level,
    levelInRank: 1,
    levelsInRank: 1,
    startLevel: 1,
    endLevel: 1,
  };
}

export function xpForDifficulty(d: Difficulty) {
  return d === "hard" ? 25 : d === "medium" ? 15 : 8;
}
