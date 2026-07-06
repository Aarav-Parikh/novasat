import { MistakeRecord } from "./novaprep-data";
import { SessionSummary } from "./novaprep-store";
import { deriveNovaStats } from "./novaprep-stats";

export type ReadinessBand = "off-track" | "on-track" | "ahead";

export interface Readiness {
  score: number; // 0-100
  band: ReadinessBand;
  reasons: string[];
  daysToTest: number | null;
  projected: number;
  target: number | null;
  weeklySessions: number;
}

export function computeReadiness(
  sessions: SessionSummary[],
  mistakes: MistakeRecord[],
  xp: number,
  targetScore: number | null | undefined,
  testDate: string | null | undefined,
): Readiness {
  const stats = deriveNovaStats(sessions, mistakes, xp, targetScore);
  const now = Date.now();
  const daysToTest = testDate
    ? Math.max(0, Math.ceil((new Date(testDate).getTime() - now) / 86_400_000))
    : null;
  const weeklySessions = sessions.filter(
    (s) => now - new Date(s.created_at).getTime() < 7 * 86_400_000,
  ).length;

  const target = targetScore ?? null;
  const projected = stats.projectedScore;

  // Base: distance from target (capped)
  let score = 60;
  const reasons: string[] = [];

  if (target) {
    const delta = projected - target;
    score = Math.round(60 + Math.max(-40, Math.min(30, delta / 6)));
    if (delta >= 20) reasons.push(`Projected ${projected} is above your ${target} goal.`);
    else if (delta <= -50) reasons.push(`Projected ${projected} is ${target - projected} below target.`);
    else reasons.push(`Projected ${projected} vs ${target} target.`);
  } else {
    reasons.push("Set a target score to sharpen this forecast.");
  }

  // Consistency
  if (weeklySessions >= 5) { score += 10; reasons.push(`Strong pace — ${weeklySessions} sessions this week.`); }
  else if (weeklySessions >= 3) { score += 4; }
  else { score -= 10; reasons.push(`Only ${weeklySessions} sessions this week — aim for 4+.`); }

  // Time pressure
  if (daysToTest !== null) {
    if (daysToTest <= 14 && (target ? projected < target - 30 : false)) {
      score -= 15;
      reasons.push(`${daysToTest} days out and still short of target — cram weak topics now.`);
    } else if (daysToTest <= 30) {
      reasons.push(`${daysToTest} days until test day.`);
    }
  }

  // Weak topic coverage
  const uniqueWeak = new Set(mistakes.map((m) => m.topic)).size;
  if (uniqueWeak > 12) {
    score -= 6;
    reasons.push(`${uniqueWeak} weak topics logged — focus reviews.`);
  }

  score = Math.max(0, Math.min(100, score));
  const band: ReadinessBand = score >= 75 ? "ahead" : score >= 50 ? "on-track" : "off-track";

  return {
    score,
    band,
    reasons: reasons.slice(0, 3),
    daysToTest,
    projected,
    target,
    weeklySessions,
  };
}
