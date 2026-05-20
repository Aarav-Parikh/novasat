import { useNavigate } from "react-router-dom";
import { Target, Zap, BookOpen, Calculator } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova } from "@/lib/novaprep-store";

const Practice = () => {
  const nav = useNavigate();
  const mistakes = useNova((s) => s.mistakes);
  const weakTopic = mistakes[0]?.topic ?? "Mixed SAT Skills";

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
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Practice</span>
        <h1 className="font-display text-4xl font-bold mt-1">Choose Your Mission</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Every session uses original AI-generated content. Pacing is tracked silently in the
          background; results feed your Flight Plan.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
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
    </AppLayout>
  );
};

export default Practice;
