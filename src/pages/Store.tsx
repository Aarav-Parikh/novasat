import { Gem, ShoppingBag, Coins, CircleCheck as CheckCircle2, PawPrint, Zap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import {
  useNova,
  COSMETIC_CATALOG,
  CosmeticItem,
  CosmeticSlot,
  formatBuff,
} from "@/lib/novaprep-store";
import { toast } from "@/hooks/use-toast";

const slotLabel: Record<CosmeticSlot, string> = {
  hat: "Headwear",
  neck: "Neckwear",
  outfit: "Outfits",
};

const Store = () => {
  const profile = useNova((s) => s.profile);
  const buy = useNova((s) => s.buyCosmetic);
  const equip = useNova((s) => s.equipCosmetic);
  const claimDailySP = useNova((s) => s.claimDailySP);
  const taskCompletions = useNova((s) => s.taskCompletions);
  const sp = profile?.sp ?? 0;
  const owned = profile?.cosmetics ?? [];
  const equipped = profile?.equipped ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = taskCompletions.some((item) => item.task_key === `daily-sp::${today}`);

  const onClaimDaily = async () => {
    if (claimedToday) return;
    const ok = await claimDailySP(25);
    if (ok) {
      toast({
        title: "+25 SP claimed",
        description: "Come back tomorrow for another daily bonus.",
      });
    }
  };

  const purchase = async (item: CosmeticItem) => {
    if (owned.includes(item.id)) {
      // Already owned → equip / unequip
      const isEquipped = equipped[item.slot] === item.id;
      const ok = await equip(item.slot, isEquipped ? null : item.id);
      if (ok)
        toast({
          title: isEquipped ? "Unequipped" : "Equipped",
          description: `${item.label} ${isEquipped ? "removed" : "is now on Buddy"}.`,
        });
      return;
    }
    const ok = await buy(item.id);
    toast(
      ok
        ? {
            title: "Cosmetic unlocked",
            description: `${item.label} added to your wardrobe — head to the Pet tab to equip it.`,
          }
        : {
            title: "Not enough SP",
            description: `You need ${item.cost} SP for ${item.label}.`,
            variant: "destructive",
          },
    );
  };

  const slots: CosmeticSlot[] = ["hat", "neck", "outfit"];

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">
            Pet Boutique
          </span>
          <h1 className="font-display text-4xl font-bold mt-1">Store</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Spend Study Points on cosmetics for Buddy — wear your SAT dedication on
            your profile.
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
        <h2 className="font-display text-2xl font-semibold mt-2">Head to Quests</h2>
        <p className="text-sm text-muted-foreground mt-2">Daily and weekly quests are the fastest way to earn SP — including your daily login bonus.</p>
        <a href="/quests" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Open Quests
        </a>
      </GlassCard>

      {slots.map((slot) => {
        const items = COSMETIC_CATALOG.filter((c) => c.slot === slot);
        return (
          <div key={slot} className="mb-8">
            <h2 className="font-display text-2xl font-semibold mb-4">
              {slotLabel[slot]}
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {items.map((item) => {
                const isOwned = owned.includes(item.id);
                const isEquipped = equipped[slot] === item.id;
                const affordable = sp >= item.cost;
                return (
                  <GlassCard
                    key={item.id}
                    className={`overflow-hidden ${
                      isEquipped ? "border-primary/40 glass-purple" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-xs uppercase tracking-widest text-secondary">
                          {slotLabel[slot]}
                        </span>
                        <h2 className="font-display text-xl font-semibold mt-2">
                          {item.label}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-2">
                          {item.description}
                        </p>
                      </div>
                      <div className="h-14 w-14 rounded-2xl border border-primary/30 bg-primary/15 flex items-center justify-center shrink-0 text-3xl">
                        {item.emoji}
                      </div>
                    </div>
                    {formatBuff(item.buff).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {formatBuff(item.buff).map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
                          >
                            <Zap className="h-3 w-3" /> {b}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Gem className="h-4 w-4 text-secondary" /> Price
                      </span>
                      <span className="font-mono text-secondary">
                        {isOwned ? "Owned" : `${item.cost} SP`}
                      </span>
                    </div>
                    <button
                      onClick={() => purchase(item)}
                      disabled={!isOwned && !affordable}
                      className={`mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isEquipped
                          ? "bg-muted text-foreground border border-primary/40"
                          : isOwned
                          ? "bg-secondary/20 text-secondary border border-secondary/40"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {isEquipped
                        ? "Equipped · tap to remove"
                        : isOwned
                        ? "Equip"
                        : affordable
                        ? "Buy"
                        : "Need more SP"}
                    </button>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        );
      })}
    </AppLayout>
  );
};

export default Store;
