// NovaSAT SAT Score Prediction Engine
// Implements: (1) Adaptive Threshold, (2) IRT-style weighting,
// (3) Drill-to-Test extrapolation, (4) Confidence intervals.
//
// All functions are pure so they can be unit-tested and reused
// across Analytics, Profile, and Dashboard.

import { Difficulty, MistakeRecord } from "./novaprep-data";
import { SessionSummary } from "./novaprep-store";

// ---------- Shared types ----------
export interface DrillResponse {
  section: "Math" | "Reading & Writing";
  difficulty: Difficulty;
  correct: boolean;
  timestamp: number; // ms epoch — used for recency weighting
}

export interface SectionPrediction {
  section: "Math" | "Reading & Writing";
  point: number;        // central estimate (200–800)
  low: number;          // lower bound of confidence interval
  high: number;         // upper bound of confidence interval
  cappedByModule2: boolean;
}

export interface ScorePrediction {
  total: number;        // central estimate (400–1600)
  low: number;
  high: number;
  sections: SectionPrediction[];
  reliability: number;  // 0–1, drives interval width
}

// ---------- 1) Adaptive Simulation: Threshold Check ----------
// SAT digital adaptive: if Module 1 accuracy < ~60%, Module 2 is "easier"
// and the section is capped near 600.
const MODULE1_QUESTIONS = 27;
const ADAPTIVE_THRESHOLD = 0.6;
const EASY_MODULE_CAP = 600;

export function classifyModule2(module1Responses: DrillResponse[]): {
  routeToEasy: boolean;
  sectionCap: number;
  module1Accuracy: number;
} {
  const sample = module1Responses.slice(0, MODULE1_QUESTIONS);
  if (sample.length === 0) {
    return { routeToEasy: false, sectionCap: 800, module1Accuracy: 0 };
  }
  const correct = sample.filter((r) => r.correct).length;
  const accuracy = correct / sample.length;
  const routeToEasy = accuracy < ADAPTIVE_THRESHOLD;
  return {
    routeToEasy,
    sectionCap: routeToEasy ? EASY_MODULE_CAP : 800,
    module1Accuracy: accuracy,
  };
}

// ---------- 2) IRT-style weighting ----------
// Easy=10, Medium=20, Hard=30. Missing an Easy while on a hot streak
// flags reliability and applies a steeper penalty (IRT "surprise").
const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

const HOT_STREAK_LENGTH = 5;          // consecutive corrects before "high-performing"
const EASY_MISS_HOT_PENALTY = 2.5;    // multiplier applied to easy misses on a streak

export function scoreResponsesIRT(responses: DrillResponse[]): {
  earned: number;
  possible: number;
  reliability: number; // 0–1
} {
  let earned = 0;
  let possible = 0;
  let streak = 0;
  let reliabilityHits = 0;
  let reliabilityChecks = 0;

  for (const r of responses) {
    const weight = DIFFICULTY_POINTS[r.difficulty];
    possible += weight;

    if (r.correct) {
      earned += weight;
      streak += 1;
    } else {
      const onHotStreak = streak >= HOT_STREAK_LENGTH;
      if (r.difficulty === "easy" && onHotStreak) {
        // IRT-style "this miss is surprising → penalize harder"
        earned -= weight * (EASY_MISS_HOT_PENALTY - 1);
        reliabilityHits += 1;
      }
      streak = 0;
    }

    if (r.difficulty === "easy") reliabilityChecks += 1;
  }

  const reliability =
    reliabilityChecks === 0
      ? 0.7
      : Math.max(0, 1 - reliabilityHits / Math.max(1, reliabilityChecks));

  return {
    earned: Math.max(0, earned),
    possible: Math.max(1, possible),
    reliability,
  };
}

// ---------- 3) Drill-to-Test extrapolation ----------
// Aggregate the last 50 responses with recency + hard-question weighting.
const EXTRAPOLATION_WINDOW = 50;
const HARD_INFLUENCE = 1.6;
const MED_INFLUENCE = 1.0;
const EASY_INFLUENCE = 0.7;

function difficultyInfluence(d: Difficulty) {
  return d === "hard" ? HARD_INFLUENCE : d === "medium" ? MED_INFLUENCE : EASY_INFLUENCE;
}

export function extrapolateSectionScore(
  responses: DrillResponse[],
  sectionCap = 800,
): { point: number; reliability: number; sampleSize: number } {
  const window = responses.slice(-EXTRAPOLATION_WINDOW);
  if (window.length === 0) {
    return { point: 500, reliability: 0.3, sampleSize: 0 };
  }

  let weightedCorrect = 0;
  let weightedTotal = 0;
  // Recency: linear ramp 0.5 → 1.0 across the window.
  window.forEach((r, i) => {
    const recency = 0.5 + 0.5 * ((i + 1) / window.length);
    const w = difficultyInfluence(r.difficulty) * recency;
    weightedTotal += w;
    if (r.correct) weightedCorrect += w;
  });

  const ability = weightedCorrect / Math.max(0.0001, weightedTotal); // 0–1
  // Map ability to 200–800. Anchor: 50% ≈ 500, 90% ≈ 760.
  const raw = 200 + ability * 650;
  const point = Math.round(Math.min(sectionCap, Math.max(200, raw)));

  // Sample-size-driven reliability: 50 responses → ~1.0, 10 → ~0.45.
  const reliability = Math.min(1, 0.3 + window.length / EXTRAPOLATION_WINDOW * 0.7);
  return { point, reliability, sampleSize: window.length };
}

// ---------- 4) Confidence intervals ----------
// Width shrinks with reliability and sample size; widens for low data.
export function buildInterval(point: number, reliability: number, cap = 800): {
  low: number;
  high: number;
} {
  const baseWidth = 80; // ±40 with no data
  const width = Math.round(baseWidth * (1.1 - reliability));
  const low = Math.max(200, point - Math.round(width / 2));
  const high = Math.min(cap, point + Math.round(width / 2));
  return { low, high };
}

// ---------- High-level orchestration ----------
export function predictSATScore(
  responsesBySection: Record<"Math" | "Reading & Writing", DrillResponse[]>,
): ScorePrediction {
  const sections: SectionPrediction[] = (["Reading & Writing", "Math"] as const).map(
    (section) => {
      const all = responsesBySection[section] ?? [];
      const { sectionCap, routeToEasy } = classifyModule2(all);
      const irt = scoreResponsesIRT(all);
      const { point, reliability } = extrapolateSectionScore(all, sectionCap);
      // Blend extrapolation with IRT proportion to stabilise the estimate.
      const irtScore = 200 + (irt.earned / irt.possible) * (sectionCap - 200);
      const blended = Math.round(point * 0.65 + irtScore * 0.35);
      const blendedReliability = (reliability + irt.reliability) / 2;
      const { low, high } = buildInterval(blended, blendedReliability, sectionCap);
      return {
        section,
        point: Math.min(sectionCap, blended),
        low,
        high,
        cappedByModule2: routeToEasy,
      };
    },
  );

  const total = sections.reduce((s, x) => s + x.point, 0);
  const low = sections.reduce((s, x) => s + x.low, 0);
  const high = sections.reduce((s, x) => s + x.high, 0);
  const reliability =
    sections.reduce((s, x) => s + (x.high - x.low), 0) / Math.max(1, sections.length * 80);

  return {
    total: Math.round(total),
    low: Math.round(low),
    high: Math.round(high),
    sections,
    reliability: Math.max(0, Math.min(1, 1 - reliability)),
  };
}

// ---------- Adapter: derive DrillResponse[] from app data ----------
// Sessions store aggregate score/total only, so we synthesise per-question
// responses using mistakes (known incorrect, with section + difficulty)
// and infer correct answers as the remaining count per session.
export function buildResponsesFromHistory(
  sessions: SessionSummary[],
  mistakes: MistakeRecord[],
): Record<"Math" | "Reading & Writing", DrillResponse[]> {
  const out: Record<"Math" | "Reading & Writing", DrillResponse[]> = {
    Math: [],
    "Reading & Writing": [],
  };

  // 1. Add every recorded mistake as an incorrect response with real difficulty.
  for (const m of mistakes) {
    const section = (m.section === "Math" ? "Math" : "Reading & Writing") as
      | "Math"
      | "Reading & Writing";
    out[section].push({
      section,
      difficulty: (m.difficulty ?? "medium") as Difficulty,
      correct: false,
      timestamp: new Date(m.created_at).getTime(),
    });
  }

  // 2. For each session, synthesise the correct answers as medium-difficulty
  //    responses spread evenly across the two sections.
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const s of ordered) {
    const correctCount = Math.max(0, s.score);
    const ts = new Date(s.created_at).getTime();
    for (let i = 0; i < correctCount; i += 1) {
      const section: "Math" | "Reading & Writing" =
        i % 2 === 0 ? "Math" : "Reading & Writing";
      out[section].push({
        section,
        difficulty: "medium",
        correct: true,
        timestamp: ts + i,
      });
    }
  }

  // Sort each section chronologically so recency weighting is meaningful.
  (Object.keys(out) as Array<keyof typeof out>).forEach((k) =>
    out[k].sort((a, b) => a.timestamp - b.timestamp),
  );

  return out;
}
