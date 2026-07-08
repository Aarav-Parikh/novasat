import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Flame, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { MistakeRecord } from "@/lib/novaprep-data";

interface CramItem {
  topic: string;
  section: string;
  count: number;
  score: number;
  reason: string;
}

interface Props {
  mistakes: MistakeRecord[];
  testDate: string | null | undefined;
  variant?: "dashboard" | "compact";
}

export function computeCramTopics(mistakes: MistakeRecord[], testDate: string | null | undefined): CramItem[] {
  if (!mistakes.length) return [];
  const now = Date.now();
  const days = testDate
    ? Math.max(1, Math.ceil((new Date(testDate).getTime() - now) / 86_400_000))
    : 60;
  // Weight: closer test = heavier weighting on high-count topics.
  const timeWeight = Math.max(1, 60 / Math.max(days, 7));

  const map = new Map<string, CramItem>();
  for (const m of mistakes) {
    const cur = map.get(m.topic) ?? {
      topic: m.topic,
      section: m.section,
      count: 0,
      score: 0,
      reason: "",
    };
    cur.count += 1;
    map.set(m.topic, cur);
  }

  const items = [...map.values()].map((c) => {
    const conceptBias = mistakes.filter((m) => m.topic === c.topic && m.reason === "Concept Gap").length;
    const pacingBias = mistakes.filter((m) => m.topic === c.topic && m.reason === "Time Pressure").length;
    c.score = c.count * timeWeight + conceptBias * 1.5;
    if (conceptBias >= pacingBias && conceptBias > 0) {
      c.reason = `${conceptBias} concept gap${conceptBias > 1 ? "s" : ""} — review the rule, then drill.`;
    } else if (pacingBias > 0) {
      c.reason = `${pacingBias} pacing miss${pacingBias > 1 ? "es" : ""} — practice under a 75s timer.`;
    } else {
      c.reason = `${c.count} miss${c.count > 1 ? "es" : ""} logged — worth a redemption run.`;
    }
    return c;
  });

  return items.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function CramWidget({ mistakes, testDate, variant = "dashboard" }: Props) {
  const items = useMemo(() => computeCramTopics(mistakes, testDate), [mistakes, testDate]);
  const days = testDate
    ? Math.max(0, Math.ceil((new Date(testDate).getTime() - Date.now()) / 86_400_000))
    : null;

  if (items.length === 0) {
    if (variant === "compact") return null;
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-4 w-4 text-warning" />
          <h3 className="font-display text-lg font-semibold">Cram This Week</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No mistakes tracked yet — take a session and weak topics will surface here.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant={variant === "dashboard" ? "cyan" : undefined}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-warning" />
          <h3 className="font-display text-lg font-semibold">Cram This Week</h3>
        </div>
        {days !== null && (
          <span className="text-xs font-mono text-muted-foreground">{days}d to test</span>
        )}
      </div>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.topic}>
            <Link
              to={`/test/redemption?topic=${encodeURIComponent(c.topic)}`}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-background/40 hover:border-secondary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.topic}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.reason}</div>
              </div>
              {variant === "dashboard" && (
                <ArrowRight className="h-4 w-4 text-secondary opacity-50 group-hover:opacity-100 shrink-0" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
