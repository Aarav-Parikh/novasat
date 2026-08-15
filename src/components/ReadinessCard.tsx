import { Readiness } from "@/lib/readiness";
import { GlassCard } from "./GlassCard";
import { Rocket } from "lucide-react";

export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { score, band, reasons, daysToTest } = readiness;
  const color = band === "ahead" ? "text-success" : band === "on-track" ? "text-secondary" : "text-warning";
  const ring = `conic-gradient(hsl(var(--secondary)) ${score * 3.6}deg, hsl(var(--muted)) 0deg)`;
  return (
    <GlassCard variant="cyan" className="h-full">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0 rounded-full" style={{ background: ring }}>
          <div className="absolute inset-1.5 rounded-full bg-background flex items-center justify-center flex-col">
            <div className="font-display text-xl font-bold">{score}</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">ready</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Rocket className="h-3.5 w-3.5 text-secondary" /> Test-Day Readiness
          </div>
          <div className={`font-display text-xl font-bold mt-1 capitalize ${color}`}>
            {band.replace("-", " ")}
            {daysToTest !== null && <span className="text-muted-foreground font-normal text-sm ml-2">· {daysToTest}d out</span>}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      </div>
    </GlassCard>
  );
}
