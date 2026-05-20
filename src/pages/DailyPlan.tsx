import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Clock, Brain, Flame, CheckCircle2, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova } from "@/lib/novaprep-store";
import {
  buildDailyRoutine,
  dailyTaskKey,
  routeForDailyTask,
} from "@/lib/daily-recommendations";

const focusMeta: Record<string, { color: string; icon: any }> = {
  "Concept Fix": { color: "text-primary border-primary/40 bg-primary/10", icon: Brain },
  "Time Management": { color: "text-secondary border-secondary/40 bg-secondary/10", icon: Clock },
  Redemption: { color: "text-warning border-warning/40 bg-warning/10", icon: Flame },
  Maintenance: { color: "text-success border-success/40 bg-success/10", icon: Sparkles },
};

const DailyPlan = () => {
  const mistakes = useNova((s) => s.mistakes);
  const sessions = useNova((s) => s.sessions);
  const taskCompletions = useNova((s) => s.taskCompletions);
  const routine = useMemo(() => buildDailyRoutine(mistakes, sessions), [mistakes, sessions]);
  const meta = focusMeta[routine.focus];
  const Icon = meta.icon;

  const completedCount = routine.tasks.filter((t) =>
    taskCompletions.some(
      (c) => c.task_key === dailyTaskKey(t) || c.task_label === t.task,
    ),
  ).length;
  const progress = Math.round((completedCount / Math.max(1, routine.tasks.length)) * 100);

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">
            AI Daily Plan
          </span>
          <h1 className="font-display text-4xl font-bold mt-1">{routine.headline}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{routine.subline}</p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${meta.color}`}
        >
          <Icon className="h-4 w-4" />
          {routine.focus}
        </div>
      </div>

      <GlassCard variant="purple" className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Today's Progress
            </p>
            <p className="font-display text-2xl font-semibold mt-1">
              {completedCount} / {routine.tasks.length} tasks complete
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">XP available</p>
            <p className="font-display text-2xl font-semibold mt-1 text-secondary">
              ≈ {routine.tasks.reduce((sum, t) => sum + t.duration * 4, 0)}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        {routine.tasks.map((t, i) => {
          const completed = taskCompletions.some(
            (c) => c.task_key === dailyTaskKey(t) || c.task_label === t.task,
          );
          return (
            <Link
              key={i}
              to={routeForDailyTask(t)}
              className={`block group rounded-xl border p-5 transition-all ${
                completed
                  ? "bg-muted/25 border-success/30"
                  : "bg-background/40 border-border/60 hover:border-secondary/50 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono text-secondary uppercase tracking-widest">
                    {t.section} · {t.duration} min
                  </div>
                  <h3
                    className={`font-display text-xl font-semibold mt-2 leading-snug ${
                      completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {t.task}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{t.reason}</p>
                </div>
                {completed ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <ArrowRight className="h-5 w-5 text-secondary opacity-50 group-hover:opacity-100 shrink-0" />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Plan recalibrates automatically as you complete sessions. Come back tomorrow for a fresh
        routine.
      </p>
    </AppLayout>
  );
};

export default DailyPlan;
