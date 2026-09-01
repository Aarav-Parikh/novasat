// Real-test anchors: SAT / PSAT / digital SAT scores and Bluebook practice tests
// the student has already taken. These feed the projection engine as `official`
// activities, which carry the highest confidence weight.

import { Activity, SectionKey } from "./projection-engine";

export type BaselineTestType = "SAT" | "PSAT" | "DSAT" | "Bluebook";

export interface BaselineScore {
  id: string;
  user_id?: string;
  test_type: BaselineTestType;
  test_label: string;
  rw_score: number;
  math_score: number;
  taken_on: string; // yyyy-mm-dd
  created_at?: string;
}

export const TEST_TYPE_LABEL: Record<BaselineTestType, string> = {
  SAT: "Official SAT",
  DSAT: "Official Digital SAT",
  PSAT: "PSAT / NMSQT",
  Bluebook: "Bluebook practice test",
};

export interface BluebookTest {
  id: string;
  label: string;
  /**
   * Difficulty adjustment in scaled points per section. Easier forms inflate a
   * student's score, so they are pulled down; harder forms are pulled up.
   */
  adjustment: number;
  note: string;
}

/** Bluebook full-length practice forms, with a per-form difficulty adjustment. */
export const BLUEBOOK_TESTS: BluebookTest[] = [
  { id: "bb1", label: "Bluebook Practice Test 1", adjustment: -20, note: "Runs easy — scores tend to read high." },
  { id: "bb2", label: "Bluebook Practice Test 2", adjustment: -20, note: "Runs easy — scores tend to read high." },
  { id: "bb3", label: "Bluebook Practice Test 3", adjustment: -10, note: "Slightly forgiving curve." },
  { id: "bb4", label: "Bluebook Practice Test 4", adjustment: +20, note: "The hardest published form." },
  { id: "bb5", label: "Bluebook Practice Test 5", adjustment: +10, note: "Harder than average." },
  { id: "bb6", label: "Bluebook Practice Test 6", adjustment: +10, note: "Harder than average." },
  { id: "bb7", label: "Bluebook Practice Test 7", adjustment: 0, note: "Close to a true test-day curve." },
  { id: "bb8", label: "Bluebook Practice Test 8", adjustment: 0, note: "Close to a true test-day curve." },
  { id: "bb9", label: "Bluebook Practice Test 9", adjustment: 0, note: "Close to a true test-day curve." },
  { id: "bb10", label: "Bluebook Practice Test 10", adjustment: 0, note: "Close to a true test-day curve." },
];

export const bluebookByLabel = (label: string) =>
  BLUEBOOK_TESTS.find((t) => t.label === label);

const clampSection = (v: number) => Math.min(800, Math.max(200, Math.round(v)));

/** Section score range accepted per test type. */
export const scoreRange = (type: BaselineTestType) =>
  type === "PSAT" ? { min: 160, max: 760 } : { min: 200, max: 800 };

/**
 * Convert a reported section score into an SAT-equivalent, adjusting for
 * PSAT scaling and for the specific Bluebook form's difficulty.
 */
export function adjustedSectionScore(entry: BaselineScore, section: SectionKey): number {
  const raw = section === "Math" ? entry.math_score : entry.rw_score;
  if (entry.test_type === "PSAT") {
    // PSAT tops out at 760 per section; stretch onto the SAT scale.
    return clampSection(200 + (raw - 160) * (600 / 600));
  }
  if (entry.test_type === "Bluebook") {
    return clampSection(raw + (bluebookByLabel(entry.test_label)?.adjustment ?? 0));
  }
  return clampSection(raw);
}

export const adjustedTotal = (entry: BaselineScore) =>
  adjustedSectionScore(entry, "Reading & Writing") + adjustedSectionScore(entry, "Math");

/** Turn a stored baseline score into a high-confidence engine activity. */
export function baselineToActivity(entry: BaselineScore): Activity {
  const rw = adjustedSectionScore(entry, "Reading & Writing");
  const math = adjustedSectionScore(entry, "Math");
  const scaledAvg = (rw + math) / 2;
  return {
    id: `official-${entry.id}`,
    kind: "official",
    section: "both",
    timestamp: new Date(`${entry.taken_on}T12:00:00`).getTime(),
    accuracy: Math.min(1, Math.max(0, (scaledAvg - 200) / 600)),
    questionCount: 98,
    scaled: { "Reading & Writing": rw, Math: math },
    difficultyAdjustment:
      entry.test_type === "Bluebook" ? bluebookByLabel(entry.test_label)?.adjustment ?? 0 : 0,
    label: `${entry.test_label} · ${rw + math}`,
    topic: TEST_TYPE_LABEL[entry.test_type],
  };
}
