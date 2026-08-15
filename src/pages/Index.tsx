import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Flame,
  Brain,
  Clock,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Gem,
  CheckCircle2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNova } from "@/lib/novaprep-store";
import { rankFromXP } from "@/lib/novaprep-data";
import {
  buildDailyRoutine,
  dailyTaskKey,
  routeForDailyTask,
} from "@/lib/daily-recommendations";
import { deriveNovaStats } from "@/lib/novaprep-stats";
import { computeReadiness } from "@/lib/readiness";
import { ReadinessCard } from "@/components/ReadinessCard";
import { CramWidget } from "@/components/CramWidget";

type Quest = { key: string; label: string; desc: string; goal: number; progress: number; reward_sp: number; kind: string; unit?: string };
type QuestsPayload = { daily: Quest[]; weekly: Quest[]; claimed: { quest_key: string }[] } | null;

const Dashboard = () => {
  const { user } = useAuth();
  const profile = useNova((s) => s.profile);
  const mistakes = useNova((s) => s.mistakes);
  const sessions = useNova((s) => s.sessions);
  const taskCompletions = useNova((s) => s.taskCompletions);
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const info = rankFromXP(xp);
  const routine = useMemo(() => buildDailyRoutine(mistakes, sessions), [mistakes, sessions]);
  const stats = useMemo(
    () => deriveNovaStats(sessions, mistakes, xp, profile?.target_score),
    [sessions, mistakes, xp, profile?.target_score],
  );
  const readiness = useMemo(
    () => computeReadiness(sessions, mistakes, xp, profile?.target_score, profile?.test_date),
    [sessions, mistakes, xp, profile?.target_score, profile?.test_date],
  );

  const [quests, setQuests] = useState<QuestsPayload>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const loadQuests = async () => {
    const { data } = await supabase.rpc("list_quests");
    setQuests(data as any);
  };

  useEffect(() => {
    if (!user) return;
    loadQuests();
  }, [user?.id, sessions.length]);

  const claimQuest = async (q: Quest) => {
    setClaiming(q.key);
    const { data, error } = await supabase.rpc("claim_quest", { _quest_key: q.key });
    setClaiming(null);
    const res = data as { ok?: boolean; reason?: string; reward_sp?: number } | null;
    if (error || !res?.ok) {
      toast({
        title: "Not yet",
        description: res?.reason === "incomplete" ? "Finish the quest first." : res?.reason ?? error?.message,
      });
      return;
    }
    toast({ title: `+${res.reward_sp} SP claimed`, description: q.label });
    loadQuests();
  };

  const projectedRange = stats.projectedRange;
  const targetSuffix = profile?.target_score ? ` / ${profile.target_score}` : "";

  const dailyPreview = (quests?.daily ?? []).slice(0, 3);
  const claimedKeys = new Set((quests?.claimed ?? []).map((c) => c.quest_key));


  return (
    <AppLayout>
      <div className="flex flex-col gap-2 mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Mission Control</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold">
          Welcome back,{" "}
          <span className="text-gradient-nebula">
            {profile?.display_name || info.rank}
          </span>
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Today's plan: <span className="text-secondary font-medium">{routine.headline}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <GlassCard className="!p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-warning" />
            Streak
          </div>
          <div className="mt-2 font-display text-3xl font-bold">{streak}</div>
        </GlassCard>
        <GlassCard className="!p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            Projected{targetSuffix}
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums">{projectedRange}</div>
        </GlassCard>
        <GlassCard className="!p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-secondary" />
            Weak Areas
          </div>
          <div className="mt-2 font-display text-3xl font-bold">
            {new Set(mistakes.map((m) => m.topic)).size}
          </div>
        </GlassCard>
        <GlassCard className="!p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-primary" />
            XP
          </div>
          <div className="mt-2 font-display text-3xl font-bold">{xp.toLocaleString()}</div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6 mb-6 items-start">
        <ReadinessCard readiness={readiness} />
        <CramWidget mistakes={mistakes} testDate={profile?.test_date} />
      </div>

      {/* Quests preview */}
      <GlassCard variant="cyan" className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-secondary" /> Today's Quests
            </span>
            <h2 className="font-display text-2xl font-semibold mt-1">Grab some SP</h2>
          </div>
          <Link to="/quests" className="text-xs text-secondary hover:text-secondary-glow inline-flex items-center gap-1 shrink-0">
            All quests <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {dailyPreview.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading quests…</p>
        ) : (
          <ul className="grid sm:grid-cols-3 gap-3">
            {dailyPreview.map((q) => {
              const claimed = claimedKeys.has(q.key);
              const done = q.progress >= q.goal;
              const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100));
              return (
                <li key={q.key} className={`rounded-lg border p-3 ${claimed ? "border-success/40 bg-success/5" : done ? "border-secondary/40 bg-secondary/5" : "border-border/60 bg-background/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-tight">{q.label}</div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-secondary">
                      <Gem className="h-3 w-3" /> {q.reward_sp}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                    {claimed ? (<><CheckCircle2 className="h-3 w-3 text-success" /> Claimed</>) : `${q.progress} / ${q.goal}`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      <div className="grid xl:grid-cols-[1.45fr_0.85fr] gap-6 items-start">
        <GlassCard variant="purple">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Today's Routine
              </span>
              <h2 className="font-display text-2xl font-semibold mt-1">{routine.headline}</h2>
            </div>
            <Link
              to="/plan"
              className="text-xs text-secondary hover:text-secondary-glow inline-flex items-center gap-1 shrink-0"
            >
              Full plan <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {routine.tasks.map((t, i) => {
              const completed = taskCompletions.some(
                (c) => c.task_key === dailyTaskKey(t) || c.task_label === t.task,
              );
              return (
                <li
                  key={i}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    completed ? "bg-muted/20 border-success/30" : "bg-background/40 border-border/60"
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${completed ? "line-through text-muted-foreground" : ""}`}
                    >
                      {t.task}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.duration} min · {t.section}
                    </div>
                  </div>
                  <Link
                    to={routeForDailyTask(t)}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary/15 text-primary-glow border border-primary/30 hover:bg-primary/25 transition-colors shrink-0"
                  >
                    {completed ? "Redo" : "Start"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </GlassCard>

        <GlassCard className="flex flex-col">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Launch a session
          </span>
          <h3 className="font-display text-2xl font-semibold mt-1">Full SAT Simulation</h3>
          <p className="text-sm text-muted-foreground mt-2 flex-1">
            Adaptive 2-module sections with silent pacing tracking. Module 2 difficulty
            calibrates to your Module 1 performance.
          </p>
          <Link
            to="/practice"
            className="mt-6 pulse-glow inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold hover:opacity-95 transition-opacity"
          >
            Begin Test <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/practice"
            className="mt-3 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Or run a 10-minute drill →
          </Link>
        </GlassCard>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
