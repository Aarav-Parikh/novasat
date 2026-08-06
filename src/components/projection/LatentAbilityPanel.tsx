import { GlassCard } from "@/components/GlassCard";
import { SkillTheta } from "@/lib/projection-engine";
import { Brain } from "lucide-react";

const bandColor = (theta: number) =>
  theta >= 70 ? "bg-success" : theta >= 45 ? "bg-warning" : "bg-destructive";

export function LatentAbilityPanel({ skills }: { skills: SkillTheta[] }) {
  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Latent ability by sub-skill</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Theta (θ) is the smoothed probability you answer a fresh item in this skill
        correctly. Drill data drives these estimates.
      </p>
      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Run topic drills to build sub-skill estimates.
        </p>
      ) : (
        <div className="space-y-3">
          {skills.slice(0, 12).map((s) => (
            <div key={`${s.section}-${s.topic}`}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="truncate">{s.topic}</span>
                <span className="ml-3 shrink-0 font-medium">θ {s.theta}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted/40">
                <div
                  className={`h-1.5 rounded-full ${bandColor(s.theta)}`}
                  style={{ width: `${s.theta}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {s.section} · {s.correct}/{s.attempts} tracked items
              </p>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
