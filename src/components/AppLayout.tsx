import { ReactNode, useEffect, useState } from "react";
import { Zap, Sparkles, Snowflake, Forward, Gem, Lightbulb, Eye, Heart, Compass } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { useNova, BoostKind } from "@/lib/novaprep-store";

const iconFor: Record<BoostKind, any> = {
  xp_2x: Zap,
  xp_3x: Sparkles,
  sp_2x: Gem,
  streak_freeze: Snowflake,
  skip_token: Forward,
  hint: Lightbulb,
  fifty_fifty: Eye,
  extra_life: Heart,
  topic_radar: Compass,
};

const formatRemaining = (expires: string) => {
  const ms = new Date(expires).getTime() - Date.now();
  if (ms <= 0) return "0s";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
};

function ActiveBoostsBar() {
  const profile = useNova((s) => s.profile);
  const prune = useNova((s) => s.pruneExpiredBoosts);
  const [, force] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      force((n) => n + 1);
      prune();
    }, 1000);
    return () => window.clearInterval(t);
  }, [prune]);

  const active = (profile?.active_boosts ?? []).filter(
    (b) => new Date(b.expires_at).getTime() > Date.now(),
  );
  if (active.length === 0) return null;

  return (
    <div className="px-4 sm:px-8 pt-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs">
        <span className="font-mono uppercase tracking-widest text-success">Active boosts</span>
        {active.map((b) => {
          const Icon = iconFor[b.kind];
          return (
            <span
              key={b.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-background/40 px-2 py-1"
            >
              <Icon className="h-3 w-3 text-success" />
              <span className="font-medium">{b.label}</span>
              <span className="font-mono text-muted-foreground">· {formatRemaining(b.expires_at)}</span>
            </span>
          );
        })}
        <span className="ml-auto font-mono text-muted-foreground">{active.length}/3 slots</span>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full">
      <div className="starfield" />
      <div className="relative z-10 flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileNav />
          <ActiveBoostsBar />
          <main className="flex-1 px-4 sm:px-8 py-6 sm:py-10 max-w-[1400px] w-full mx-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
