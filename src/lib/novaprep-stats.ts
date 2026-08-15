import { MistakeRecord } from "./novaprep-data";
import { SessionSummary } from "./novaprep-store";
import { buildResponsesFromHistory, predictSATScore } from "./score-engine";
import { roundTo10 } from "./projection-engine";


export function deriveNovaStats(
  sessions: SessionSummary[],
  mistakes: MistakeRecord[],
  xp: number,
  targetScore?: number | null,
) {
  const totalAnswered = sessions.reduce((sum, s) => sum + s.total, 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + s.score, 0);
  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const avgPace = totalAnswered > 0 ? Math.round(totalSeconds / totalAnswered) : 0;
  const hoursLogged = Number((totalSeconds / 3600).toFixed(1));
  const bestAccuracy = sessions.length
    ? Math.max(...sessions.map((s) => Math.round((s.score / Math.max(1, s.total)) * 100)))
    : 0;
  const weeklyXP = sessions.slice(0, 7).reduce((sum, s) => sum + s.xp_earned, 0);

  // New scoring engine: adaptive + IRT + extrapolation + intervals.
  const responses = buildResponsesFromHistory(sessions, mistakes);
  const prediction = predictSATScore(responses);

  // Light XP / target nudges so progress still moves the central estimate.
  const xpNudge = Math.min(40, xp / 50);
  const targetAnchor = targetScore
    ? Math.min(30, Math.max(-30, (targetScore - prediction.total) / 18))
    : 0;
  const rawProjected = Math.min(1600, Math.max(400, Math.round(prediction.total + xpNudge + targetAnchor)));
  const projectedScore = roundTo10(rawProjected);
  const projectedLow = roundTo10(Math.min(projectedScore, Math.max(400, prediction.low + Math.round(xpNudge))));
  const projectedHigh = roundTo10(Math.min(1600, Math.max(projectedScore, prediction.high + Math.round(xpNudge))));


  return {
    totalAnswered,
    totalCorrect,
    totalSeconds,
    accuracy,
    avgPace,
    hoursLogged,
    bestAccuracy,
    weeklyXP,
    projectedScore,
    projectedLow,
    projectedHigh,
    projectedRange: `${projectedLow}–${projectedHigh}`,
    sectionPredictions: prediction.sections,
    reliability: prediction.reliability,
  };
}
