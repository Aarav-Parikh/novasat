import { GlassCard } from "@/components/GlassCard";
import { ProjectionResult, SectionKey } from "@/lib/projection-engine";
import { AlertTriangle, Target } from "lucide-react";

export function ScoreTracker({ result }: { result: ProjectionResult }) {
  return (
    <GlassCard variant="purple" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Projected SAT score
          </p>
          <div className="flex items-end gap-3">
            <span className="text-5xl font-bold text-foreground">{result.total}</span>
            <span className="mb-1 text-sm text-muted-foreground">
              ± {result.confidenceBand} pts
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Confidence band {result.totalLow} – {result.totalHigh}
          </p>
        </div>
        <Target className="h-6 w-6 text-primary" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {result.sections.map((s) => (
          <SectionBar key={s.section} {...s} />
        ))}
      </div>

      {result.staminaRisk && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-warning">Stamina / fatigue risk</p>
            <p className="text-muted-foreground">
              Second-half accuracy dropped more than 25% in a full simulation. The
              projection carries a 15-point fatigue penalty until that gap closes.
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function SectionBar({
  section,
  point,
  low,
  high,
  cap,
  routedToEasy,
}: {
  section: SectionKey;
  point: number;
  low: number;
  high: number;
  cap: number;
  routedToEasy: boolean;
}) {
  const pct = ((point - 200) / 600) * 100;
  const lowPct = ((low - 200) / 600) * 100;
  const widthPct = ((high - low) / 600) * 100;
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{section}</span>
        <span className="text-2xl font-semibold text-foreground">{point}</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-muted/40">
        <div
          className="absolute h-2 rounded-full bg-primary/30"
          style={{ left: `${lowPct}%`, width: `${widthPct}%` }}
        />
        <div
          className="absolute -top-1 h-4 w-1 rounded-full bg-primary"
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {low} – {high}
        {routedToEasy && (
          <span className="ml-2 text-warning">
            Routed to easy Module 2 · capped at {cap}
          </span>
        )}
      </p>
    </div>
  );
}
