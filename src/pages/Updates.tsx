import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { Sparkles, Wrench, Bug } from "lucide-react";

type Entry = {
  version: string;
  date: string;
  features?: string[];
  fixes?: string[];
};

// Newest first.
const UPDATES: Entry[] = [
  {
    version: "v1.0.0",
    date: "Initial launch",
    features: [
      "Adaptive SAT practice: Reading & Writing drills, Math drills, short simulations, and full-length two-module simulations with strict topic and section locking.",
      "Personalized daily plans that rebuild every day from your latest misses, plus targeted weak-concept and reinforcement drills.",
      "Post-Test Review Dashboard: full answer key, flip-card flashcards, error categorization, concept breakdowns, and per-question breakdowns with the underlying pattern and a faster shortcut.",
      "Reason-tagged option eliminator and question flagging with subject-aware reasons for Math and Reading & Writing.",
      "Adaptive pacing bars on full simulation modules that show whether you are on or off pace, then fade away once you have calibrated.",
      "Score Projection Engine: weighted Bayesian projection with confidence range, activity impact timeline, latent-ability breakdown, and a what-if simulator.",
      "Analytics and readiness: accuracy trends, pacing telemetry, weak-area diagnostics, session history, badges, and a Cram This Week shortlist.",
      "Daily and weekly SP quests, claimable straight from the dashboard, plus a daily login bonus.",
      "Buddy, your study companion: XP levels, energy, treats, cosmetics, and an SP store.",
      "Google and email sign-in, synced cloud profiles and progress, and an administrator activity console.",
    ],
    fixes: [
      "Initial public release of NovaSAT.",
    ],
  },
];



export default function Updates() {
  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Update Log</span>
        <h1 className="font-display text-4xl font-bold">Update Log</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Every shipped improvement, feature, and fix. Newest at the top.
        </p>
      </div>

      <div className="space-y-6">
        {UPDATES.map((u) => (
          <GlassCard key={u.version} variant={u === UPDATES[0] ? "purple" : undefined}>
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
              <h2 className="font-display text-2xl font-bold text-gradient-nebula">{u.version}</h2>
              <span className="text-xs text-muted-foreground">{u.date}</span>
            </div>
            {u.features && u.features.length > 0 && (
              <section className="mb-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-secondary mb-2">
                  <Sparkles className="h-3.5 w-3.5" /> New
                </div>
                <ul className="space-y-1.5 text-sm">
                  {u.features.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-secondary mt-1">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {u.fixes && u.fixes.length > 0 && (
              <section>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-success mb-2">
                  <Wrench className="h-3.5 w-3.5" /> Fixes & polish
                </div>
                <ul className="space-y-1.5 text-sm">
                  {u.fixes.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-success mt-1">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </GlassCard>
        ))}
      </div>
    </AppLayout>
  );
}
