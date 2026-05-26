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
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova } from "@/lib/novaprep-store";

const REINFORCE_TOPICS = [
  "Quadratics",
  "Linear Functions",
  "Reading: Inference",
  "Grammar: Punctuation",
  "Data Analysis",
  "Vocabulary in Context",
];

const Practice = () => {
  const nav = useNavigate();
  const mistakes = useNova((s) => s.mistakes);
  const weakTopic = mistakes[0]?.topic ?? "Mixed SAT Skills";

  const weakDrills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of mistakes) counts.set(m.topic, (counts.get(m.topic) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
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
      desc: `Fresh AI-generated questions tuned to ${weakTopic}. Pure practice — no replays.`,
      cta: "Enter Arena",
      duration: "18 min",
      route: `/test/redemption?topic=${encodeURIComponent(weakTopic)}`,
    },
  ];

  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Practice & Coach</span>
        <h1 className="font-display text-4xl font-bold mt-1">Choose Your Mission</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Every session uses original AI-generated content. Pacing is tracked silently in the
          background; results feed your Flight Plan and the Coach's recommendations.
        </p>
      </div>

      {/* Coach note */}
      <GlassCard variant="purple" className="mb-8">
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
            <Link to="/articles" className="mt-3 inline-flex items-center gap-1 text-sm text-secondary hover:text-secondary-glow">
              Browse the article library <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </GlassCard>

      {/* Core sessions */}
      <h2 className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
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
      <h2 className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" /> Drills for your weak concepts
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        {weakDrills.length === 0 ? (
          <GlassCard><p className="text-sm text-muted-foreground">No weak areas yet — take a drill or full test to surface them.</p></GlassCard>
        ) : weakDrills.map(([topic, count], i) => (
          <Link key={topic} to={`/test/redemption?topic=${encodeURIComponent(topic)}`} className="block">
            <GlassCard className="group cursor-pointer hover:scale-[1.01] transition-transform h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-secondary">{count} miss{count === 1 ? "" : "es"}</span>
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
      <h2 className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
        <Repeat className="h-5 w-5 text-secondary" /> Reinforcement drills
      </h2>
      <p className="text-sm text-muted-foreground mb-3 max-w-2xl">Spaced practice on concepts you've already worked on, so they stay sharp.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {REINFORCE_TOPICS.map((topic) => (
          <Link key={topic} to={`/test/redemption?topic=${encodeURIComponent(topic)}`} className="block">
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
