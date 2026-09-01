import { useState } from "react";
import { Rocket, X } from "lucide-react";
import { BaselineScoreForm } from "./BaselineScoreForm";
import { useBaselineScores } from "@/hooks/useBaselineScores";
import { adjustedTotal } from "@/lib/baseline-scores";

/** Asks a brand-new student for any real scores they already have. */
export function BaselineOnboardingModal({ onClose }: { onClose: () => void }) {
  const { scores, add } = useBaselineScores();
  const [added, setAdded] = useState(0);

  const handleAdd = async (entry: Parameters<typeof add>[0]) => {
    const ok = await add(entry);
    if (ok) setAdded((n) => n + 1);
    return ok;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-xl rounded-2xl border border-border/70 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Start from your real score</h2>
              <p className="text-sm text-muted-foreground">
                Taken an SAT, digital SAT, PSAT or a Bluebook practice test? Add it and your
                projection starts from reality instead of a guess.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Skip"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <BaselineScoreForm onAdd={handleAdd} compact />
        </div>

        {scores.length > 0 && (
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            {scores.map((s) => (
              <div key={s.id} className="flex justify-between">
                <span>{s.test_label}</span>
                <span className="font-mono text-foreground">{adjustedTotal(s)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {added > 0 ? "Done" : "I haven't taken one yet"}
          </button>
        </div>
      </div>
    </div>
  );
}
