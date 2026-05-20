import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useNova } from "@/lib/novaprep-store";
import { deriveNovaStats } from "@/lib/novaprep-stats";

const Analytics = () => {
  const mistakes = useNova((s) => s.mistakes);
  const profile = useNova((s) => s.profile);
  const sessions = useNova((s) => s.sessions).slice().reverse();
  const stats = deriveNovaStats(sessions, mistakes, profile?.xp ?? 0, profile?.target_score);

  const scoreData = useMemo(() => {
    if (!sessions.length) {
      return [{ week: "Start", score: stats.projectedScore }];
    }
    return sessions.map((s, i) => {
      const acc = s.total > 0 ? s.score / s.total : 0;
      const volume = Math.min(180, sessions.slice(0, i + 1).reduce((a, row) => a + row.total, 0));
      const projected = Math.min(profile?.target_score ?? 1600, Math.round(980 + acc * 420 + volume * 1.1 + (profile?.xp ?? 0) / 22));
      return { week: `S${i + 1}`, score: projected };
    });
  }, [sessions, profile?.xp, profile?.target_score, stats.projectedScore]);

  const paceData = useMemo(() => {
    const byTopic = new Map<string, { sum: number; n: number }>();
    for (const m of mistakes) {
      const cur = byTopic.get(m.topic) ?? { sum: 0, n: 0 };
      cur.sum += m.time_spent;
      cur.n += 1;
      byTopic.set(m.topic, cur);
    }
    return [...byTopic.entries()]
      .map(([topic, v]) => ({ topic: topic.length > 14 ? topic.slice(0, 12) + "…" : topic, sec: Math.round(v.sum / v.n) }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 8);
  }, [mistakes]);

  const modeData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) counts.set(s.mode, (counts.get(s.mode) ?? 0) + 1);
    return [...counts.entries()].map(([mode, count]) => ({ mode, count }));
  }, [sessions]);

  const topicStrengths = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of mistakes) counts.set(m.topic, (counts.get(m.topic) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      weakest: sorted[0]?.[0] ?? "—",
      strongest: sorted.length > 0 ? sorted[sorted.length - 1][0] : "—",
    };
  }, [mistakes]);

  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Telemetry</span>
        <h1 className="font-display text-4xl font-bold mt-1">Analytics</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Track your projected score and time-per-question by topic.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard variant="cyan" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Projected Score</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Range <span className="font-mono text-secondary">{stats.projectedRange}</span> · central{" "}
                <span className="font-mono">{stats.projectedScore}</span> · reliability{" "}
                <span className="font-mono">{Math.round(stats.reliability * 100)}%</span>
              </p>
              <div className="flex gap-3 mt-2 text-[11px] font-mono text-muted-foreground">
                {stats.sectionPredictions.map((s) => (
                  <span key={s.section}>
                    {s.section === "Math" ? "M" : "RW"}: {s.low}–{s.high}
                    {s.cappedByModule2 ? " ⓘ easy mod" : ""}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-xs text-success font-mono">{sessions.length} sessions</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[800, 1600]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="font-display text-xl font-semibold">Stats</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Accuracy</span>
              <span className="font-mono">{stats.accuracy}%</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Avg pace</span>
              <span className="font-mono">{stats.avgPace}s / Q</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Tests taken</span>
              <span className="font-mono">{sessions.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Hours logged</span>
              <span className="font-mono">{stats.hoursLogged}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Best accuracy</span>
              <span className="font-mono text-success">{stats.bestAccuracy}%</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">7-session XP</span>
              <span className="font-mono text-secondary">+{stats.weeklyXP}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Strongest</span>
              <span className="text-secondary truncate ml-2">{topicStrengths.strongest}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Weakest</span>
              <span className="text-warning truncate ml-2">{topicStrengths.weakest}</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Avg Time on Weak-Area Questions</h2>
            <span className="text-xs text-muted-foreground">target ≤ 75s</span>
          </div>
          {paceData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Take a session to populate pacing data.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paceData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="topic" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="sec" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <h2 className="font-display text-xl font-semibold mb-4">Session Mix</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeData.length ? modeData : [{ mode: "none", count: 0 }]}> 
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="mode" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="font-display text-xl font-semibold">Recent Sessions</h2>
          <div className="mt-4 space-y-2">
            {sessions.slice(-5).reverse().map((s, i) => (
              <div key={`${s.created_at}-${i}`} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
                <span className="capitalize text-muted-foreground">{s.mode}</span>
                <span className="font-mono">{s.score}/{s.total}</span>
                <span className="text-secondary">+{s.xp_earned} XP</span>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
};

export default Analytics;
