import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Activity,
  ACTIVITY_WEIGHT,
  ActivityKind,
  IMPACT_LABEL,
  KIND_LABEL,
  SectionKey,
  SECTIONS,
  emptySplit,
} from "@/lib/projection-engine";
import { cn } from "@/lib/utils";
import { FlaskConical, RotateCcw } from "lucide-react";

const KIND_QUESTIONS: Record<ActivityKind, number> = {
  drill: 10,
  module: 27,
  full: 98,
  official: 98,

};

export function ProjectionSimulator({
  onSubmit,
  onReset,
  simCount,
}: {
  onSubmit: (a: Activity) => void;
  onReset: () => void;
  simCount: number;
}) {
  const [kind, setKind] = useState<ActivityKind>("drill");
  const [section, setSection] = useState<SectionKey | "both">("Math");
  const [accuracy, setAccuracy] = useState(70);
  const [module2Accuracy, setModule2Accuracy] = useState(70);

  const submit = () => {
    const total = KIND_QUESTIONS[kind];
    const split = emptySplit();
    const correct = Math.round((accuracy / 100) * total);
    // Rough difficulty spread so the lucky-guess filter has something to read.
    split.easyTotal = Math.round(total * 0.4);
    split.mediumTotal = Math.round(total * 0.4);
    split.hardTotal = total - split.easyTotal - split.mediumTotal;
    split.hardCorrect = Math.min(split.hardTotal, Math.round(correct * 0.25));
    split.mediumCorrect = Math.min(split.mediumTotal, Math.round(correct * 0.35));
    split.easyCorrect = Math.max(
      0,
      Math.min(split.easyTotal, correct - split.hardCorrect - split.mediumCorrect),
    );

    onSubmit({
      id: `sim-${Date.now()}`,
      kind,
      section: kind === "full" ? "both" : section,
      timestamp: Date.now(),
      accuracy: accuracy / 100,
      questionCount: total,
      module1Accuracy: accuracy / 100,
      module2Accuracy: kind === "full" ? module2Accuracy / 100 : undefined,
      split,
      label: `Simulated ${KIND_LABEL[kind]}`,
    });
  };

  return (
    <GlassCard variant="cyan" className="space-y-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-secondary" />
        <h2 className="text-lg font-semibold">Interactive projection simulator</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Submit a hypothetical result and watch the engine re-weight your baseline live.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(ACTIVITY_WEIGHT) as ActivityKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              kind === k
                ? "border-primary bg-primary/10"
                : "border-border/60 bg-background/30 hover:bg-background/50",
            )}
          >
            <p className="text-sm font-medium">{KIND_LABEL[k]}</p>
            <p className="text-xs text-muted-foreground">
              W {ACTIVITY_WEIGHT[k].toFixed(2)} · {IMPACT_LABEL[k]}
            </p>
          </button>
        ))}
      </div>

      {kind !== "full" && (
        <div className="flex flex-wrap gap-2">
          {([...SECTIONS, "both"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                section === s
                  ? "border-secondary bg-secondary/15 text-secondary"
                  : "border-border/60 text-muted-foreground hover:bg-background/50",
              )}
            >
              {s === "both" ? "Both sections" : s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {kind === "full" ? "Section 1 accuracy" : "Accuracy"}
          </span>
          <span className="font-medium">{accuracy}%</span>
        </div>
        <Slider
          value={[accuracy]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => setAccuracy(v)}
        />
        {accuracy < 60 && kind !== "drill" && (
          <p className="text-xs text-warning">
            Below 60% on Module 1 → routed to easy Module 2, section capped at 600.
          </p>
        )}
      </div>

      {kind === "full" && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Section 2 accuracy</span>
            <span className="font-medium">{module2Accuracy}%</span>
          </div>
          <Slider
            value={[module2Accuracy]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => setModule2Accuracy(v)}
          />
          {accuracy > 0 && (accuracy - module2Accuracy) / accuracy > 0.25 && (
            <p className="text-xs text-warning">
              &gt;25% drop between sections → stamina penalty of 15 points applied.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit}>Submit {KIND_LABEL[kind]} result</Button>
        {simCount > 0 && (
          <Button variant="ghost" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Clear {simCount} simulated
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
