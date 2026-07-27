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
    date: "July 27, 2026",
    features: [
      "Practice & Daily Plan are now one page — today's plan, coach note, sessions, and weak-concept drills in a single flow.",
      "Analytics & Weak Areas combined into one diagnostic page with score projection, pacing charts, and weak-skill cards.",
      "The NovaSAT rocket mark now appears everywhere the logo shows up.",
      "Google profile pictures import automatically and stay in sync on every sign-in.",
      "Wrong-answer explanations now include the underlying SAT pattern and a faster shortcut, not just why the answer is right.",
    ],
    fixes: [
      "Review prompt now appears from the second login onward and keeps asking until you review or choose 'Don't ask again'.",
      "Closing the review popup no longer silently disables it forever.",
      "Profile pictures can now be saved to your account (previously blocked by permissions).",
      "Old Daily Plan and Weak Areas links redirect to their new combined pages.",
    ],
  },
];


export default function Updates() {
  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">What's New</span>
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
