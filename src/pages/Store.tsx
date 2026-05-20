import { Gem, Zap, Sparkles, ShoppingBag, Snowflake, Gift, Eye, Lightbulb, Coins, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova, StoreItem } from "@/lib/novaprep-store";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

const items: (StoreItem & { icon: any; tagline: string; tier: "common" | "rare" | "epic" })[] = [
  { id: "xp2x_30", kind: "xp_2x", label: "2x XP · 30 min", description: "Doubles XP for 30 minutes of practice.", cost: 50, minutes: 30, icon: Zap, tagline: "XP boost", tier: "common" },
  { id: "xp3x_30", kind: "xp_3x", label: "3x XP · 30 min", description: "Triple XP for 30 minutes. Stack with other boosts.", cost: 120, minutes: 30, icon: Sparkles, tagline: "Premium XP", tier: "epic" },
  { id: "streak_freeze", kind: "streak_freeze", label: "Streak Freeze · 24h", description: "Protect your daily streak for 24 hours.", cost: 60, minutes: 60 * 24, icon: Snowflake, tagline: "Insurance", tier: "rare" },
  { id: "hint_pack", kind: "hint", label: "Hint · 1 use", description: "Reveals a one-line hint for the current question during a test.", cost: 55, icon: Lightbulb, tagline: "Coach assist", tier: "common" },
  { id: "fifty_fifty", kind: "fifty_fifty", label: "50/50 · 1 use", description: "Removes two wrong answers from the current multiple-choice question.", cost: 70, icon: Eye, tagline: "Elimination", tier: "rare" },
  { id: "sp_2x_30", kind: "sp_2x", label: "2x SP · 30 min", description: "Doubles SP earned from mystery boxes for 30 minutes.", cost: 90, minutes: 30, icon: Gem, tagline: "Wealth", tier: "rare" },
];

const tierStyle: Record<string, string> = {
  common: "border-border",
  rare: "border-secondary/40 glass-cyan",
  epic: "border-primary/40 glass-purple glow-purple",
};

const Store = () => {
  const profile = useNova((s) => s.profile);
  const buy = useNova((s) => s.buyStoreItem);
  const claimDailySP = useNova((s) => s.claimDailySP);
  const sp = profile?.sp ?? 0;
  const [claimedToday, setClaimedToday] = useState(false);

  const dailyKey = profile ? `np_daily_sp_${profile.id}_${new Date().toISOString().slice(0, 10)}` : "";

  useEffect(() => {
    if (!dailyKey) return;
    setClaimedToday(localStorage.getItem(dailyKey) === "1");
  }, [dailyKey]);

  const onClaimDaily = async () => {
    if (claimedToday) return;
    const ok = await claimDailySP(25);
    if (ok) {
      localStorage.setItem(dailyKey, "1");
      setClaimedToday(true);
      toast({ title: "+25 SP claimed", description: "Come back tomorrow for another daily bonus." });
    }
  };

  const purchase = async (item: StoreItem) => {
    const ok = await buy(item);
    toast(
      ok
        ? {
            title: "Added to inventory",
            description: `${item.label} is ready to activate from your Rewards tab.`,
          }
        : {
            title: "Not enough SP",
            description: `You need ${item.cost} SP for ${item.label}.`,
            variant: "destructive",
          },
    );
  };

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">Supply Depot</span>
          <h1 className="font-display text-4xl font-bold mt-1">Store</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Spend Study Points on boosts and tools. Purchases land in your Rewards inventory — activate
            them when you're ready.
          </p>
        </div>
        <div className="glass px-4 py-3 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Gem className="h-4 w-4 text-secondary" /> {sp.toLocaleString()} SP
        </div>
      </div>

      <GlassCard variant="purple" className="mb-8">
        <div className="flex items-center gap-2 text-secondary text-xs uppercase tracking-[0.25em]">
          <Coins className="h-3.5 w-3.5" /> Earn SP
        </div>
        <h2 className="font-display text-2xl font-semibold mt-2">Ways to stack SP</h2>
        <div className="mt-5 grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Daily login bonus</span>
              <span className="font-mono text-secondary">+25 SP</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Claim once every 24 hours. Resets at midnight.</p>
            <button
              onClick={onClaimDaily}
              disabled={claimedToday}
              className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimedToday ? (<><CheckCircle2 className="h-4 w-4" /> Claimed</>) : (<>Claim 25 SP</>)}
            </button>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Complete drills</span>
              <span className="font-mono text-secondary">+5 SP</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Finish any practice or full simulation to earn SP automatically.</p>
            <a href="/practice" className="mt-3 block w-full text-center rounded-lg border border-secondary/40 px-3 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10">Go to Practice</a>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Open mystery boxes</span>
              <span className="font-mono text-secondary">+5–40 SP</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Level up to earn boxes — many drop SP directly into your wallet.</p>
            <a href="/boxes" className="mt-3 block w-full text-center rounded-lg border border-secondary/40 px-3 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10">Open boxes</a>
          </div>
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map((item) => {
          const Icon = item.icon;
          const affordable = sp >= item.cost;
          return (
            <GlassCard key={item.id} className={`overflow-hidden ${tierStyle[item.tier]}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-secondary">
                    {item.tagline}
                  </span>
                  <h2 className="font-display text-xl font-semibold mt-2">{item.label}</h2>
                  <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl border border-primary/30 bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Gift className="h-4 w-4" /> Stock
                </span>
                <span className="font-mono text-secondary">{item.cost} SP</span>
              </div>
              <button
                onClick={() => purchase(item)}
                disabled={!affordable}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="h-4 w-4" /> {affordable ? "Buy" : "Need more SP"}
              </button>
            </GlassCard>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Store;
