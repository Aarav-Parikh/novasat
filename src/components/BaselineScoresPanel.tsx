import { Trash2, Target } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { BaselineScoreForm } from "./BaselineScoreForm";
import { useBaselineScores } from "@/hooks/useBaselineScores";
import { adjustedSectionScore, adjustedTotal } from "@/lib/baseline-scores";

/** Manage the real tests a student has already taken. */
export function BaselineScoresPanel() {
  const { scores, loading, add, remove } = useBaselineScores();

  return (
    <GlassCard data-page-section="Real Test Scores" variant="purple" className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-secondary" />
        <h2 className="font-display text-xl font-semibold">Real test scores</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Add any official SAT, digital SAT, PSAT or Bluebook practice test you have taken.
        Each one anchors your projection with the engine's highest confidence weight
        (W = 0.95), and Bluebook forms are difficulty-adjusted per test.
      </p>

      <BaselineScoreForm onAdd={add} compact />

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading your scores…</div>
        ) : scores.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
            No real scores logged yet.
          </div>
        ) : (
          scores.map((s) => {
            const rw = adjustedSectionScore(s, "Reading & Writing");
            const math = adjustedSectionScore(s, "Math");
            const raw = s.rw_score + s.math_score;
            const adj = adjustedTotal(s);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.test_label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {new Date(`${s.taken_on}T12:00:00`).toLocaleDateString()} · RW {s.rw_score} ·
                    Math {s.math_score}
                    {adj !== raw && (
                      <> · adjusted to {rw} / {math}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display text-lg font-bold tabular-nums">{adj}</span>
                  <button
                    onClick={() => remove(s.id)}
                    aria-label="Remove score"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}
