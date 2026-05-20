import { useMemo } from "react";
import { Sparkles, ChevronRight, Target, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
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

const AICoach = () => {
  const mistakes = useNova((s) => s.mistakes);

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

  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">AI Coach</span>
        <h1 className="font-display text-4xl font-bold mt-1">Targeted Drill Recommendations</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          The Coach watches your mistakes and assembles drills focused on your weak concepts —
          plus reinforcement drills so you don't forget what you've already learned.
        </p>
      </div>

      <GlassCard variant="purple" className="mb-6">
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

      <h2 className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" /> Drills for your weak concepts
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
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

      <h2 className="font-display text-2xl font-semibold mt-10 mb-3 flex items-center gap-2">
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

export default AICoach;
