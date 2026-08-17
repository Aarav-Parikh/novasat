import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Target,
  Zap,
  BookOpen,
  Calculator,
  Sparkles,
  ChevronRight,
  Repeat,
  Clock,
  Brain,
  Flame,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova } from "@/lib/novaprep-store";
import {
  buildDailyRoutine,
  dailyTaskKey,
  routeForDailyTask,
} from "@/lib/daily-recommendations";

const REINFORCE_TOPICS = [
  "Quadratics",
  "Linear Functions",
  "Reading: Inference",
  "Grammar: Punctuation",
  "Data Analysis",
  "Vocabulary in Context",
];

const focusMeta: Record<string, { color: string; icon: any }> = {
  "Concept Fix": { color: "text-primary border-primary/40 bg-primary/10", icon: Brain },
  "Time Management": { color: "text-secondary border-secondary/40 bg-secondary/10", icon: Clock },
  Redemption: { color: "text-warning border-warning/40 bg-warning/10", icon: Flame },
  Maintenance: { color: "text-success border-success/40 bg-success/10", icon: Sparkles },
};

const Practice = () => {
  const nav = useNavigate();
  const mistakes = useNova((s) => s.mistakes);
  const allSessions = useNova((s) => s.sessions);
  const taskCompletions = useNova((s) => s.taskCompletions);
  const weakTopic = mistakes[0]?.topic ?? "Mixed SAT Skills";

  const routine = useMemo(
    () => buildDailyRoutine(mistakes, allSessions),
    [mistakes, allSessions],
  );
  const meta = focusMeta[routine.focus] ?? focusMeta.Maintenance;
  const FocusIcon = meta.icon;

  const completedCount = routine.tasks.filter((t) =>
    taskCompletions.some(
      (c) => c.task_key === dailyTaskKey(t) || c.task_label === t.task,
    ),
  ).length;
  const progress = Math.round((completedCount / Math.max(1, routine.tasks.length)) * 100);

  const weakDrills = useMemo(() => {
    const counts = new Map<string, { count: number; section: string }>();
    for (const m of mistakes) counts.set(m.topic, { count: (counts.get(m.topic)?.count ?? 0) + 1, section: m.section });
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  }, [mistakes]);

  const dominantReason = useMemo(() => {
    const r = { "Concept Gap": 0, "Time Pressure": 0, Misreading: 0 };
    for (const m of mistakes) r[m.reason]++;
    return Object.entries(r).sort((a, b) => b[1] - a[1])[0];
  }, [mistakes]);

  const sessions = [
    {
      id: "full",
      icon: Target,
      title: "Full SAT Simulation",
      desc: "98-question SAT build: 54 Reading & Writing questions, then 44 Math questions with real section timing.",
      cta: "Begin Simulation",
      duration: "2h 14m",
      route: "/test/full",
      highlight: true,
    },
    {
      id: "shortfull",
      icon: Zap,
      title: "Short SAT Simulation",
      desc: "Quick 36-question SAT mock: 20 Reading & Writing, then 16 Math. Same structure as the full test, half the time.",
      cta: "Start Short Sim",
      duration: "50 min",
      route: "/test/shortfull",
    },
    {
      id: "rw-drill",
      icon: BookOpen,
      title: "Reading & Writing Drill",
      desc: "Short, focused set covering Main Idea, Inference, and Grammar.",
      cta: "Start Drill",
      duration: "32 min",
      route: "/test/reading",
    },
    {
      id: "math-drill",
      icon: Calculator,
      title: "Math Sprint",
      desc: "Algebra, Quadratics, and Data Analysis — paced at 75 seconds per question.",
      cta: "Start Sprint",
      duration: "70 min",
      route: "/test/math",
    },
    {
      id: "redemption",
      icon: Zap,
      title: "Weak-Skill Arena",
      desc: `Fresh questions tuned to ${weakTopic}. Pure practice — no replays.`,
      cta: "Enter Arena",
      duration: "18 min",
      route: `/test/redemption?topic=${encodeURIComponent(weakTopic)}`,
    },
  ];

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">
            Practice & Daily Plan
          </span>
          <h1 className="font-display text-4xl font-bold mt-1">{routine.headline}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{routine.subline}</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${meta.color}`}>
          <FocusIcon className="h-4 w-4" />
          {routine.focus}
        </div>
      </div>

      {/* Today's plan */}
      <GlassCard data-page-section="Today's Plan" variant="purple" className="mb-5">
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

      <div className="grid gap-4 md:grid-cols-2 mb-10">
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

      {/* Coach note */}
      <GlassCard data-page-section="Coach Note" variant="purple" className="mb-8">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold">Today's Coach Note</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {mistakes.length === 0 ? (
                <>Run your first session and the Coach will start tailoring drills to your weak spots.</>
              ) : (
                <>
                  Your dominant error pattern is{" "}
                  <span className="text-foreground font-medium">{dominantReason[0]}</span> ({dominantReason[1]}{" "}
                  occurrence{dominantReason[1] === 1 ? "" : "s"}). Start with the top weak-area drill below.
                </>
              )}
            </p>
            <Link to="/analytics" className="mt-3 inline-flex items-center gap-1 text-sm text-secondary hover:text-secondary-glow">
              Review your weak areas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </GlassCard>

      {/* Core sessions */}
      <h2 data-page-section="Sessions" className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" /> Sessions
      </h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch mb-10">
        {sessions.map((s) => (
          <GlassCard
            key={s.id}
            variant={s.highlight ? "purple" : "default"}
            className="flex flex-col"
          >
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-secondary" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{s.duration}</span>
            </div>
            <h3 className="font-display text-xl font-semibold mt-4">{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 flex-1">{s.desc}</p>
            <button
              onClick={() => nav(s.route)}
              className={`mt-5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                s.highlight
                  ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground pulse-glow"
                  : "bg-muted hover:bg-accent border border-border"
              }`}
            >
              {s.cta}
            </button>
          </GlassCard>
        ))}
      </div>

      {/* Weak concept drills (from coach) */}
      <h2 data-page-section="Weak Concept Drills" className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" /> Drills for your weak concepts
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        {weakDrills.length === 0 ? (
          <GlassCard><p className="text-sm text-muted-foreground">No weak areas yet — take a drill or full test to surface them.</p></GlassCard>
        ) : weakDrills.map(([topic, info], i) => (
          <Link key={topic} to={`/test/redemption?topic=${encodeURIComponent(topic)}&section=${encodeURIComponent(info.section)}`} className="block">
            <GlassCard className="group cursor-pointer hover:scale-[1.01] transition-transform h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-secondary">{info.count} miss{info.count === 1 ? "" : "es"}</span>
                {i === 0 && <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-primary/15 text-primary-glow border border-primary/30">Recommended</span>}
              </div>
              <h3 className="font-display text-lg font-semibold mt-3">{topic}</h3>
              <p className="text-sm text-muted-foreground mt-2">Targeted drill on this exact concept. Coach explanations after each question.</p>
              <div className="mt-4 flex items-center gap-1 text-sm text-secondary group-hover:text-secondary-glow">Start drill <ChevronRight className="h-4 w-4" /></div>
            </GlassCard>
          </Link>
        ))}
      </div>

      {/* Reinforcement */}
      <h2 data-page-section="Reinforcement" className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
        <Repeat className="h-5 w-5 text-secondary" /> Reinforcement drills
      </h2>
      <p className="text-sm text-muted-foreground mb-3 max-w-2xl">Spaced practice on concepts you've already worked on, so they stay sharp.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {REINFORCE_TOPICS.map((topic) => (
          <Link key={topic} to={`/test/redemption?topic=${encodeURIComponent(topic)}&section=${encodeURIComponent(/Reading|Grammar|Vocabulary/.test(topic) ? "Reading & Writing" : "Math")}`} className="block">
            <GlassCard className="group cursor-pointer hover:scale-[1.01] transition-transform h-full">
              <h3 className="font-display text-base font-semibold">{topic}</h3>
              <p className="text-xs text-muted-foreground mt-2">Quick reinforcement drill to keep this concept fresh.</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-secondary group-hover:text-secondary-glow">Practice <ChevronRight className="h-3.5 w-3.5" /></div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
};

export default Practice;
