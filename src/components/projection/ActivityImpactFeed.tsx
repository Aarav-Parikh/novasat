import { GlassCard } from "@/components/GlassCard";
import {
  AppliedActivity,
  IMPACT_LABEL,
  KIND_LABEL,
} from "@/lib/projection-engine";
import { cn } from "@/lib/utils";
import { Activity as ActivityIcon, Dices, Timer, TrendingDown, TrendingUp } from "lucide-react";

const impactStyle: Record<string, string> = {
  drill: "bg-secondary/15 text-secondary border-secondary/40",
  module: "bg-primary/15 text-primary border-primary/40",
  full: "bg-warning/15 text-warning border-warning/40",
};

const relative = (ts: number) => {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

export function ActivityImpactFeed({ items }: { items: AppliedActivity[] }) {
  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center gap-2">
        <ActivityIcon className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Activity impact timeline</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activities yet. Finish a drill or use the simulator below to see how each
          result moves the projection.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-border/60 pl-5">
          {items.slice(0, 25).map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[27px] top-3 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{KIND_LABEL[a.kind]}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      impactStyle[a.kind],
                    )}
                  >
                    {IMPACT_LABEL[a.kind]} · W {a.weightBase.toFixed(2)}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {relative(a.timestamp)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {Math.round(a.accuracy * 100)}% · {a.questionCount} questions
                  </span>
                  <span>{a.section === "both" ? "Both sections" : a.section}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 font-medium",
                      a.delta >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {a.delta >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {a.delta >= 0 ? "+" : ""}
                    {a.delta} pts
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {a.decayFactor < 1 && (
                    <Tag icon={Timer}>Recency decay ×{a.decayFactor.toFixed(2)}</Tag>
                  )}
                  {a.luckyGuessFiltered && (
                    <Tag icon={Dices}>Lucky-guess filter · impact halved</Tag>
                  )}
                  {a.routedToEasy && <Tag>Easy Module 2 · capped {a.sectionCap}</Tag>}
                  {a.staminaFlagged && <Tag>Stamina penalty −15</Tag>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}

function Tag({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
