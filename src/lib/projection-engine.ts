// NovaSAT Score Projection Engine
// Hierarchical Bayesian / weighted Kalman-style filter.
//
// Every completed activity carries a Confidence Coefficient (W) that decides
// how strongly it pulls the running projected baseline:
//   drill  -> 0.10   (low impact, updates sub-skill theta)
//   module -> 0.40   (medium impact, adaptive test conditions)
//   full   -> 0.90   (high baseline pivot)
//
// New = Current + W * (ActivityPerformance - Current)
//
// All functions are pure so the UI, the simulator, and tests can share them.

import { Difficulty, MistakeRecord } from "./novaprep-data";
import { SessionSummary } from "./novaprep-store";

export type SectionKey = "Reading & Writing" | "Math";
export type ActivityKind = "drill" | "module" | "full" | "official";

export const SECTIONS: SectionKey[] = ["Reading & Writing", "Math"];

export const ACTIVITY_WEIGHT: Record<ActivityKind, number> = {
  drill: 0.1,
  module: 0.4,
  full: 0.9,
  // A real, proctored test (SAT/PSAT/digital SAT) or a Bluebook practice test is
  // the strongest evidence there is — it nearly resets the baseline.
  official: 0.95,
};

export const IMPACT_LABEL: Record<ActivityKind, string> = {
  drill: "Low Impact",
  module: "Medium Impact",
  full: "High Baseline Pivot",
  official: "Official Anchor",
};

export const KIND_LABEL: Record<ActivityKind, string> = {
  drill: "Drill",
  module: "Module",
  full: "Full Simulation",
  official: "Official / Bluebook Score",
};

export interface DifficultySplit {
  easyCorrect: number;
  easyTotal: number;
  mediumCorrect: number;
  mediumTotal: number;
  hardCorrect: number;
  hardTotal: number;
}

export const emptySplit = (): DifficultySplit => ({
  easyCorrect: 0,
  easyTotal: 0,
  mediumCorrect: 0,
  mediumTotal: 0,
  hardCorrect: 0,
  hardTotal: 0,
});

export interface Activity {
  id: string;
  kind: ActivityKind;
  /** Section touched. Full simulations touch both. */
  section: SectionKey | "both";
  timestamp: number;
  /** Overall accuracy 0-1 */
  accuracy: number;
  questionCount: number;
  /** Module 1 accuracy — drives the dSAT routing rule. */
  module1Accuracy?: number;
  /** Second half accuracy — drives the stamina check on full sims. */
  module2Accuracy?: number;
  topic?: string;
  split?: DifficultySplit;
  label?: string;
  /**
   * Reported scaled section scores (200-800). Used by `official` activities so
   * a real test anchors the baseline directly instead of going through accuracy.
   * Already difficulty-adjusted by the caller.
   */
  scaled?: Partial<Record<SectionKey, number>>;
  /** Difficulty adjustment applied to a Bluebook practice test, in points. */
  difficultyAdjustment?: number;
}

export interface AppliedActivity extends Activity {
  weightBase: number;
  weightEffective: number;
  performance: Record<SectionKey, number>;
  before: Record<SectionKey, number>;
  after: Record<SectionKey, number>;
  delta: number; // total-score shift (out of 1600)
  routedToEasy: boolean;
  sectionCap: number;
  luckyGuessFiltered: boolean;
  staminaFlagged: boolean;
  decayFactor: number;
}

export interface SkillTheta {
  topic: string;
  section: SectionKey;
  theta: number; // 0-100 latent ability
  attempts: number;
  correct: number;
}

export interface ProjectionResult {
  total: number;
  totalLow: number;
  totalHigh: number;
  sections: Array<{
    section: SectionKey;
    point: number;
    low: number;
    high: number;
    cap: number;
    routedToEasy: boolean;
  }>;
  applied: AppliedActivity[];
  skills: SkillTheta[];
  staminaRisk: boolean;
  confidenceBand: number;
}

// ---------------------------------------------------------------- constants
const BASELINE_START = 500;
const SECTION_MIN = 200;
const SECTION_MAX = 800;
const EASY_MODULE_CAP = 600;
const ROUTING_THRESHOLD = 0.6;
const DECAY_GRACE_DAYS = 14;
const DECAY_PER_WEEK = 0.2;
const LUCKY_GUESS_DISCOUNT = 0.5;
const STAMINA_DROP = 0.25;
const STAMINA_PENALTY = 15;
export const CONFIDENCE_BAND = 30;

/** Round a score to the nearest 10 — SAT scores are always reported in 10s. */
export const roundTo10 = (v: number) => Math.round(v / 10) * 10;

const clampSection = (v: number, cap = SECTION_MAX) =>
  Math.round(Math.min(cap, Math.max(SECTION_MIN, v)));


/** Map raw accuracy (0-1) onto the 200-800 scaled-score equivalent. */
export function accuracyToScaled(accuracy: number, cap = SECTION_MAX): number {
  const a = Math.min(1, Math.max(0, accuracy));
  // 0% -> 200, 50% -> ~510, 100% -> 800 with a gentle S-curve.
  const shaped = 0.5 * a + 0.5 * Math.pow(a, 1.15);
  return clampSection(SECTION_MIN + shaped * 600, cap);
}

/** Recency decay: full weight for 14 days, then -20% per additional week. */
export function recencyDecay(timestamp: number, now = Date.now()): number {
  const days = (now - timestamp) / 86_400_000;
  if (days <= DECAY_GRACE_DAYS) return 1;
  const weeksPast = Math.floor((days - DECAY_GRACE_DAYS) / 7) + 1;
  return Math.max(0.2, Math.pow(1 - DECAY_PER_WEEK, weeksPast));
}

/** Lucky guess: hard items right while easy items are missed at low ability. */
export function isLuckyGuess(split: DifficultySplit | undefined, currentAbility: number): boolean {
  if (!split) return false;
  const easyMissed = split.easyTotal - split.easyCorrect;
  const hardHit = split.hardCorrect;
  const lowSkill = currentAbility < 500;
  return lowSkill && hardHit > 0 && easyMissed > 0;
}

/** dSAT routing: <60% on Module 1 caps the section near 600. */
export function routeModule2(module1Accuracy: number | undefined) {
  if (module1Accuracy === undefined) return { routedToEasy: false, cap: SECTION_MAX };
  const routedToEasy = module1Accuracy < ROUTING_THRESHOLD;
  return { routedToEasy, cap: routedToEasy ? EASY_MODULE_CAP : SECTION_MAX };
}

/** Stamina: >25% relative drop between the two halves of a full sim. */
export function hasStaminaDrop(a?: number, b?: number): boolean {
  if (a === undefined || b === undefined || a <= 0) return false;
  return (a - b) / a > STAMINA_DROP;
}

// ---------------------------------------------------------------- the filter
export function runProjection(
  activities: Activity[],
  opts: { now?: number; skills?: SkillTheta[] } = {},
): ProjectionResult {
  const now = opts.now ?? Date.now();
  const ordered = [...activities].sort((a, b) => a.timestamp - b.timestamp);

  const baseline: Record<SectionKey, number> = {
    "Reading & Writing": BASELINE_START,
    Math: BASELINE_START,
  };
  const caps: Record<SectionKey, number> = {
    "Reading & Writing": SECTION_MAX,
    Math: SECTION_MAX,
  };
  const routed: Record<SectionKey, boolean> = {
    "Reading & Writing": false,
    Math: false,
  };

  const applied: AppliedActivity[] = [];
  let staminaRisk = false;

  for (const act of ordered) {
    const targets: SectionKey[] =
      act.section === "both" ? SECTIONS : [act.section];

    const before = { ...baseline };
    const decay = recencyDecay(act.timestamp, now);
    const baseWeight = ACTIVITY_WEIGHT[act.kind];

    const avgAbility =
      targets.reduce((s, k) => s + baseline[k], 0) / targets.length;
    const lucky = isLuckyGuess(act.split, avgAbility);

    let weight = baseWeight * decay * (lucky ? LUCKY_GUESS_DISCOUNT : 1);
    weight = Math.min(0.95, Math.max(0.01, weight));

    // Routing applies to modules and full sims only.
    let routedToEasy = false;
    let sectionCap = SECTION_MAX;
    if (act.kind === "official") {
      // A reported real score already reflects whatever module the student was
      // routed into, so it lifts any previous easy-module cap.
      for (const k of targets) {
        caps[k] = SECTION_MAX;
        routed[k] = false;
      }
    } else if (act.kind !== "drill") {
      const r = routeModule2(act.module1Accuracy ?? act.accuracy);
      routedToEasy = r.routedToEasy;
      sectionCap = r.cap;
      for (const k of targets) {
        caps[k] = sectionCap;
        routed[k] = routedToEasy;
      }
    }

    const stamina =
      act.kind === "full" && hasStaminaDrop(act.module1Accuracy, act.module2Accuracy);
    if (stamina) staminaRisk = true;

    const performance = {} as Record<SectionKey, number>;
    for (const k of SECTIONS) performance[k] = baseline[k];

    for (const k of targets) {
      const perf =
        act.kind === "official" && act.scaled?.[k] !== undefined
          ? clampSection(act.scaled[k] as number)
          : accuracyToScaled(act.accuracy, act.kind === "drill" || act.kind === "official" ? SECTION_MAX : sectionCap);
      performance[k] = perf;
      let next = baseline[k] + weight * (perf - baseline[k]);
      if (stamina) next -= STAMINA_PENALTY / targets.length + STAMINA_PENALTY / 2;
      baseline[k] = clampSection(next, act.kind === "official" ? SECTION_MAX : act.kind === "drill" ? caps[k] : sectionCap);
    }

    const delta =
      SECTIONS.reduce((s, k) => s + baseline[k], 0) -
      SECTIONS.reduce((s, k) => s + before[k], 0);

    applied.push({
      ...act,
      weightBase: baseWeight,
      weightEffective: weight,
      performance,
      before,
      after: { ...baseline },
      delta: Math.round(delta),
      routedToEasy,
      sectionCap,
      luckyGuessFiltered: lucky,
      staminaFlagged: stamina,
      decayFactor: decay,
    });
  }

  const sections = SECTIONS.map((section) => {
    const point = roundTo10(clampSection(baseline[section], caps[section]));
    return {
      section,
      point,
      low: roundTo10(Math.max(SECTION_MIN, point - CONFIDENCE_BAND / 2)),
      high: roundTo10(Math.min(caps[section], point + CONFIDENCE_BAND / 2)),
      cap: caps[section],
      routedToEasy: routed[section],
    };
  });

  const total = roundTo10(sections.reduce((s, x) => s + x.point, 0));

  return {
    total,
    totalLow: roundTo10(Math.max(400, total - CONFIDENCE_BAND)),
    totalHigh: roundTo10(Math.min(1600, total + CONFIDENCE_BAND)),

    sections,
    applied: applied.reverse(), // newest first for the feed
    skills: opts.skills ?? [],
    staminaRisk,
    confidenceBand: CONFIDENCE_BAND,
  };
}

// ------------------------------------------------- adapters from app history
const inferKind = (mode: string, total: number): ActivityKind => {
  if (mode === "full" || mode === "shortfull") return "full";
  if (mode === "test") return total >= 20 ? "module" : "drill";
  return "drill";
};

const sectionForMistake = (s: string): SectionKey =>
  s === "Math" ? "Math" : "Reading & Writing";

/** Build engine activities from stored sessions + mistake records. */
export function activitiesFromHistory(
  sessions: SessionSummary[],
  mistakes: MistakeRecord[],
): Activity[] {
  return sessions
    .filter((s) => s.total > 0 && s.mode !== "review")
    .map((s) => {
      const ts = new Date(s.created_at).getTime();
      // Mistakes logged within the session window tell us section + difficulty.
      const near = mistakes.filter((m) => {
        const mt = new Date(m.created_at).getTime();
        return Math.abs(mt - ts) < (s.duration_seconds + 300) * 1000;
      });
      const split = emptySplit();
      for (const m of near) {
        const d = (m.difficulty ?? "medium") as Difficulty;
        if (d === "easy") split.easyTotal += 1;
        else if (d === "hard") split.hardTotal += 1;
        else split.mediumTotal += 1;
      }
      const mathMisses = near.filter((m) => m.section === "Math").length;
      const rwMisses = near.length - mathMisses;
      const kind = inferKind(s.mode, s.total);
      const section: Activity["section"] =
        kind === "full" || near.length === 0
          ? "both"
          : mathMisses > 0 && rwMisses === 0
            ? "Math"
            : rwMisses > 0 && mathMisses === 0
              ? "Reading & Writing"
              : "both";
      const accuracy = s.score / Math.max(1, s.total);
      return {
        id: s.id,
        kind,
        section,
        timestamp: ts,
        accuracy,
        questionCount: s.total,
        module1Accuracy: accuracy,
        module2Accuracy: kind === "full" ? accuracy : undefined,
        split,
        label: KIND_LABEL[kind],
      } satisfies Activity;
    });
}

/** Latent ability (theta 0-100) per sub-skill, driven by drill/mistake data. */
export function skillThetas(
  mistakes: MistakeRecord[],
  activities: Activity[],
): SkillTheta[] {
  const map = new Map<string, SkillTheta>();
  const bump = (topic: string, section: SectionKey, correct: boolean) => {
    const key = `${section}::${topic}`;
    const cur = map.get(key) ?? { topic, section, theta: 50, attempts: 0, correct: 0 };
    cur.attempts += 1;
    if (correct) cur.correct += 1;
    map.set(key, cur);
  };

  for (const m of mistakes) bump(m.topic || "General", sectionForMistake(m.section), false);
  for (const a of activities) {
    if (!a.topic) continue;
    const section: SectionKey = a.section === "Math" ? "Math" : "Reading & Writing";
    const correct = Math.round(a.accuracy * a.questionCount);
    for (let i = 0; i < a.questionCount; i += 1) bump(a.topic, section, i < correct);
  }

  return [...map.values()]
    .map((s) => {
      // Shrink toward the 50 prior when the sample is small (Bayesian smoothing).
      const prior = 5;
      const theta = Math.round(((s.correct + prior * 0.5) / (s.attempts + prior)) * 100);
      return { ...s, theta };
    })
    .sort((a, b) => a.theta - b.theta);
}
