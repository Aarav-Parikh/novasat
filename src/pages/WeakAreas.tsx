import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingDown, ArrowRight, Target, Zap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova } from "@/lib/novaprep-store";

interface WeakArea {
  topic: string;
  section: string;
  count: number;
  conceptGap: number;
  timePressure: number;
  misreading: number;
  avgTime: number;
  severity: "Critical" | "High" | "Medium";
}

const severityStyle: Record<WeakArea["severity"], string> = {
  Critical: "bg-destructive/15 text-destructive border-destructive/40",
  High: "bg-warning/15 text-warning border-warning/40",
  Medium: "bg-secondary/15 text-secondary border-secondary/40",
};

const WeakAreas = () => {
  const mistakes = useNova((s) => s.mistakes);
  const sessions = useNova((s) => s.sessions);

  const weakAreas = useMemo<WeakArea[]>(() => {
    const map = new Map<string, WeakArea>();
    for (const m of mistakes) {
      const cur = map.get(m.topic) ?? {
        topic: m.topic,
        section: m.section,
        count: 0,
        conceptGap: 0,
        timePressure: 0,
        misreading: 0,
        avgTime: 0,
        severity: "Medium" as const,
      };
      cur.count += 1;
      if (m.reason === "Concept Gap") cur.conceptGap += 1;
      if (m.reason === "Time Pressure") cur.timePressure += 1;
      if (m.reason === "Misreading") cur.misreading += 1;
      cur.avgTime = (cur.avgTime * (cur.count - 1) + m.time_spent) / cur.count;
      map.set(m.topic, cur);
    }
    const list = [...map.values()].sort((a, b) => b.count - a.count);
    return list.map((w) => ({
      ...w,
      severity:
        w.count >= 4 ? "Critical" : w.count >= 2 ? "High" : "Medium",
      avgTime: Math.round(w.avgTime),
    }));
  }, [mistakes]);

  const totalSessions = sessions.length;
  const overallAccuracy = totalSessions
    ? Math.round(
        (sessions.reduce((s, x) => s + x.score, 0) /
          Math.max(1, sessions.reduce((s, x) => s + x.total, 0))) *
          100,
      )
    : 0;

  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Diagnostic</span>
        <h1 className="font-display text-4xl font-bold mt-1">Weak Areas</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Topics where your accuracy or pacing needs work. Practice fresh fresh questions on
          these skills — no memorization, no replays.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <GlassCard>
          <TrendingDown className="h-5 w-5 text-warning" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-3">
            Tracked weaknesses
          </p>
          <p className="font-display text-3xl font-bold mt-1">{weakAreas.length}</p>
        </GlassCard>
        <GlassCard>
          <Target className="h-5 w-5 text-secondary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-3">
            Overall accuracy
          </p>
          <p className="font-display text-3xl font-bold mt-1">{overallAccuracy}%</p>
        </GlassCard>
        <GlassCard>
          <Zap className="h-5 w-5 text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-3">
            Top focus
          </p>
          <p className="font-display text-xl font-semibold mt-1 truncate">
            {weakAreas[0]?.topic ?? "—"}
          </p>
        </GlassCard>
      </div>

      {weakAreas.length === 0 ? (
        <GlassCard className="text-center text-muted-foreground py-16">
          <Target className="h-10 w-10 mx-auto mb-4 text-muted-foreground/60" />
          No weak areas detected yet. Run a few practice sessions and the system will surface skills
          worth focusing on.
        </GlassCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {weakAreas.map((w) => (
            <Link
              key={w.topic}
              to={`/test/redemption?topic=${encodeURIComponent(w.topic)}`}
              className="group block rounded-xl border border-border/60 bg-background/40 p-5 hover:border-secondary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${severityStyle[w.severity]}`}
                  >
                    {w.severity}
                  </span>
                  <h3 className="font-display text-xl font-semibold mt-3 truncate">{w.topic}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{w.section}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-secondary opacity-50 group-hover:opacity-100 shrink-0" />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Misses</p>
                  <p className="font-mono">{w.count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Concept</p>
                  <p className="font-mono text-primary">{w.conceptGap}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pacing</p>
                  <p className="font-mono text-warning">{w.timePressure}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg time</p>
                  <p className="font-mono">{w.avgTime}s</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default WeakAreas;
