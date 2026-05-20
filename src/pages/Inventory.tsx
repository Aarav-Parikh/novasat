import { useEffect, useState } from "react";
import { Backpack, Zap, Snowflake, Forward, Gem, Sparkles, Lightbulb, Eye, Heart, Compass, Gamepad2, Wand2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova, BoostKind, isInstantBoost, isActivatedBoost } from "@/lib/novaprep-store";
import { toast } from "@/hooks/use-toast";

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
  if (ms <= 0) return "Expired";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}m ${sec.toString().padStart(2, "0")}s`;
};

const Inventory = () => {
  const profile = useNova((s) => s.profile);
  const activate = useNova((s) => s.activateInventoryItem);
  const prune = useNova((s) => s.pruneExpiredBoosts);
  const [, force] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      force((n) => n + 1);
      prune();
    }, 1000);
    return () => window.clearInterval(t);
  }, [prune]);

  const inventory = profile?.inventory ?? [];
  const active = (profile?.active_boosts ?? []).filter(
    (b) => new Date(b.expires_at).getTime() > Date.now(),
  );

  // Auto-activate any "instant" items the moment they show up in inventory
  // (timed XP/SP boosts and streak freezes auto-apply with no user click).
  useEffect(() => {
    const instants = inventory.filter((i) => isInstantBoost(i.kind));
    if (instants.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const item of instants) {
        if (cancelled) break;
        await activate(item.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inventory, activate]);

  const activatedItems = inventory.filter((i) => isActivatedBoost(i.kind));
  const instantItems = inventory.filter((i) => isInstantBoost(i.kind));

  const onActivate = async (id: string) => {
    if (active.length >= 3) {
      toast({
        title: "Slot limit reached",
        description: "You can only have 3 active boosts at once. Wait for one to expire.",
        variant: "destructive",
      });
      return;
    }
    const ok = await activate(id);
    if (ok) toast({ title: "Boost activated", description: "Buff added to your active rewards." });
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Loadout</span>
        <h1 className="font-display text-4xl font-bold mt-1">Rewards & Boosts</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Activated buffs you trigger yourself. Instant buffs auto-apply the moment you earn them.
        </p>
      </div>

      <GlassCard variant="purple" className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Active Boosts</h2>
          <span className="text-xs font-mono text-muted-foreground">{active.length} / 3 slots</span>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active boosts. Activated items live below — instant items auto-apply the second you earn them.
          </p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {active.map((b) => {
              const Icon = iconFor[b.kind];
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-success/30 bg-success/10 p-4 flex items-center gap-3"
                >
                  <Icon className="h-5 w-5 text-success" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.label}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {formatRemaining(b.expires_at)} left
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <h2 className="font-display text-2xl font-semibold mb-2 flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-secondary" /> Activated Buffs ({activatedItems.length})
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        You trigger these manually — most of them inside a test session.
      </p>
      {activatedItems.length === 0 ? (
        <GlassCard className="text-center text-muted-foreground py-8 mb-8">
          No activated buffs yet. Open boxes or visit the Store to stock up.
        </GlassCard>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {activatedItems.map((item) => {
            const Icon = iconFor[item.kind];
            return (
              <GlassCard key={item.id}>
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl border border-primary/30 bg-primary/15 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {new Date(item.acquired_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold mt-4">{item.label}</h3>
                {item.minutes && (
                  <p className="text-xs text-muted-foreground mt-1">Lasts {item.minutes} minutes</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-secondary">
                  <Gamepad2 className="h-3.5 w-3.5" /> Use during a question
                </div>
                <div className="mt-2 w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-muted-foreground text-center">
                  Available in test session
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <h2 className="font-display text-2xl font-semibold mb-2 flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-secondary" /> Instant Buffs ({instantItems.length})
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        These auto-apply the instant you earn them — no clicks needed.
      </p>
      {instantItems.length === 0 ? (
        <GlassCard className="text-center text-muted-foreground py-8">
          No instant buffs in queue. They auto-apply on pickup.
        </GlassCard>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {instantItems.map((item) => {
            const Icon = iconFor[item.kind];
            return (
              <GlassCard key={item.id}>
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl border border-success/30 bg-success/15 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-success" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Auto
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold mt-4">{item.label}</h3>
                {item.minutes && (
                  <p className="text-xs text-muted-foreground mt-1">Lasts {item.minutes} minutes</p>
                )}
                <div className="mt-3 text-xs text-success">Activating…</div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Inventory;
