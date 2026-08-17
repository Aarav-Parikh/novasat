import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { ScoreTracker } from "@/components/projection/ScoreTracker";
import { ActivityImpactFeed } from "@/components/projection/ActivityImpactFeed";
import { LatentAbilityPanel } from "@/components/projection/LatentAbilityPanel";
import { ProjectionSimulator } from "@/components/projection/ProjectionSimulator";
import { useNova } from "@/lib/novaprep-store";
import {
  Activity,
  activitiesFromHistory,
  runProjection,
  skillThetas,
} from "@/lib/projection-engine";

const SIM_KEY = "nova.projection.simulated";

const loadSims = (): Activity[] => {
  try {
    const raw = localStorage.getItem(SIM_KEY);
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch {
    return [];
  }
};

const Projection = () => {
  const sessions = useNova((s) => s.sessions);
  const mistakes = useNova((s) => s.mistakes);
  const [sims, setSims] = useState<Activity[]>(loadSims);

  useEffect(() => {
    localStorage.setItem(SIM_KEY, JSON.stringify(sims));
  }, [sims]);

  const { result, skills } = useMemo(() => {
    const real = activitiesFromHistory(sessions, mistakes);
    const all = [...real, ...sims];
    const s = skillThetas(mistakes, all);
    return { result: runProjection(all, { skills: s }), skills: s };
  }, [sessions, mistakes, sims]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Score Projection Engine</h1>
          <p className="text-muted-foreground">
            A weighted Bayesian filter that blends drills, modules, and full simulations
            into one live projection — with recency decay, lucky-guess filtering, and
            adaptive Module 2 routing.
          </p>
        </header>

        <div data-page-section="Score Tracker"><ScoreTracker result={result} /></div>

        <div data-page-section="Activity Impact" className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <ActivityImpactFeed items={result.applied} />
          <div className="space-y-6">
            <LatentAbilityPanel skills={skills} />
            <GlassCard className="space-y-2 text-sm text-muted-foreground">
              <h2 className="text-base font-semibold text-foreground">
                How the weighting works
              </h2>
              <p>New = Current + W × (Activity performance − Current)</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Drills carry W = 0.10 — they refine sub-skill θ, not the baseline.</li>
                <li>Modules carry W = 0.40 under adaptive, timed conditions.</li>
                <li>Full simulations carry W = 0.90 and pivot the baseline.</li>
                <li>Data older than 14 days loses 20% of its weight per extra week.</li>
                <li>Hard hits paired with easy misses at low ability count for half.</li>
                <li>A &gt;25% second-half drop adds a 15-point fatigue penalty.</li>
              </ul>
            </GlassCard>
          </div>
        </div>

        <div data-page-section="Simulator"><ProjectionSimulator
          simCount={sims.length}
          onSubmit={(a) => setSims((prev) => [...prev, a])}
          onReset={() => setSims([])}
        /></div>
      </div>
    </AppLayout>
  );
};

export default Projection;
