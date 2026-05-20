import { useMemo, useState } from "react";
import { Gift, Sparkles, Star, Gem, Zap, Box, PartyPopper } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { useNova, BoxReward, MysteryBox } from "@/lib/novaprep-store";
import { toast } from "@/hooks/use-toast";

const tierStyles = {
  common: "glass border-border",
  rare: "glass glass-cyan border-secondary/40",
  epic: "glass glass-purple border-primary/40",
  legendary: "glass border-warning/50 glow-purple",
} as const;

const tierLabels = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" } as const;
const tierIcon = { common: Gift, rare: Sparkles, epic: Star, legendary: PartyPopper } as const;

const Boxes = () => {
  const boxes = useNova((s) => s.mysteryBoxes);
  const profile = useNova((s) => s.profile);
  const upgradeMysteryBox = useNova((s) => s.upgradeMysteryBox);
  const openMysteryBox = useNova((s) => s.openMysteryBox);
  const unopened = useMemo(() => boxes.filter((box) => !box.reward_payload && !box.claimed_at), [boxes]);
  const opened = useMemo(() => boxes.filter((box) => box.reward_payload || box.claimed_at), [boxes]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [lastReward, setLastReward] = useState<BoxReward | null>(null);
  const activeBox = boxes.find((box) => box.id === activeId) ?? null;

  const [upgradeFlash, setUpgradeFlash] = useState<{ to: MysteryBox["tier"] } | null>(null);
  const [tapShake, setTapShake] = useState(false);

  const beginOpening = () => {
    if (!unopened.length) return;
    setLastReward(null);
    setUpgradeFlash(null);
    setActiveId(unopened[0].id);
  };

  const onTapBox = async (box: MysteryBox) => {
    if (opening || lastReward) return;
    if (box.upgrade_clicks_used < 3) {
      const before = box.tier;
      const result = await upgradeMysteryBox(box.id);
      if (!result) return;
      if (result.tier !== before) {
        setUpgradeFlash({ to: result.tier });
        window.setTimeout(() => setUpgradeFlash(null), 1100);
      } else {
        // No upgrade — show shake feedback so the user knows the tap registered
        setTapShake(true);
        window.setTimeout(() => setTapShake(false), 500);
      }
      return;
    }
    // All upgrades done — this tap opens it
    setOpening(true);
    setLastReward(null);
    window.setTimeout(async () => {
      const reward = await openMysteryBox(box.id);
      setLastReward(reward);
      setOpening(false);
      if (reward) toast({ title: "Reward unlocked", description: reward.label });
    }, 900);
  };

  const nextBox = () => {
    const remaining = unopened.filter((box) => box.id !== activeId);
    setLastReward(null);
    setActiveId(remaining[0]?.id ?? null);
  };

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">Reward Bay</span>
          <h1 className="font-display text-4xl font-bold mt-1">Mystery Boxes</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">Open level rewards Starr Drop-style: tap each box up to 3 times, then reveal SP or timed 2x XP.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="glass px-4 py-3 text-sm text-muted-foreground">{unopened.length} unopened · {(profile?.sp ?? 0).toLocaleString()} SP</div>
          <button onClick={beginOpening} disabled={!unopened.length} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Open boxes</button>
        </div>
      </div>

      {activeBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-xl animate-fade-in p-5">
          <div className="glass glass-purple max-w-md w-full p-8 text-center overflow-hidden relative">
            <div className={opening ? "absolute inset-0 bg-primary/20 animate-pulse" : ""} />
            <div className="relative z-10">
              <span className="text-xs uppercase tracking-[0.25em] text-secondary">Level {activeBox.level_number} Drop</span>

              <button
                onClick={() => onTapBox(activeBox)}
                disabled={opening || !!lastReward}
                aria-label={activeBox.upgrade_clicks_used >= 3 ? "Tap to open" : "Tap to upgrade"}
                className={`mx-auto mt-6 flex h-44 w-44 items-center justify-center rounded-[2rem] border bg-gradient-to-br from-primary/25 to-secondary/25 transition-transform active:scale-95 cursor-pointer ${opening ? "animate-[pulse_0.35s_ease-in-out_infinite] glow-purple" : upgradeFlash ? "glow-purple scale-110 ring-4 ring-primary/60" : tapShake ? "animate-[boxShake_0.4s_ease-in-out]" : "animate-float"}`}
              >
                <Box className={`h-24 w-24 ${upgradeFlash ? "text-primary-glow" : "text-secondary"}`} />
              </button>

              {upgradeFlash && (
                <div className="mt-4 animate-scale-in inline-block rounded-full bg-primary/20 border border-primary/50 px-4 py-1.5 text-sm font-semibold text-primary-glow">
                  ⬆ Upgraded to {tierLabels[upgradeFlash.to]}!
                </div>
              )}

              <h2 className="mt-4 font-display text-3xl font-bold text-gradient-nebula">{tierLabels[activeBox.tier]} Drop</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {lastReward
                  ? "Reward revealed!"
                  : activeBox.upgrade_clicks_used >= 3
                  ? "Tap the box to open it"
                  : `Tap the box · ${3 - activeBox.upgrade_clicks_used} upgrade tap${3 - activeBox.upgrade_clicks_used === 1 ? "" : "s"} left`}
              </p>

              {lastReward && (
                <div className="mt-6 animate-scale-in rounded-xl border border-success/30 bg-success/10 p-4">
                  {lastReward.type === "sp" ? <Gem className="mx-auto h-7 w-7 text-secondary" /> : lastReward.type === "xp_boost" ? <Zap className="mx-auto h-7 w-7 text-warning" /> : <Sparkles className="mx-auto h-7 w-7 text-primary" />}
                  <div className="mt-2 font-display text-xl font-semibold">{lastReward.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lastReward.type === "sp" ? "Added to your SP balance." : "Saved to your Rewards inventory — activate it when ready."}
                  </p>
                  <button onClick={nextBox} className="mt-4 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{unopened.length > 1 ? "Next box" : "Done"}</button>
                </div>
              )}

              <button onClick={() => setActiveId(null)} className="mt-4 text-xs text-muted-foreground hover:text-foreground">Close</button>
            </div>
          </div>
        </div>
      )}

      {unopened.length === 0 ? (
        <GlassCard className="text-center py-12">
          <Box className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-2xl font-semibold mt-4">No boxes waiting</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Earn more XP to unlock new mystery boxes. Each new level drops a fresh crate here.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {unopened.map((box) => {
            const Icon = tierIcon[box.tier];
            return (
              <GlassCard key={box.id} className={`overflow-hidden ${tierStyles[box.tier]}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-secondary">Level {box.level_number}</p>
                    <h2 className="font-display text-2xl font-semibold mt-2">{tierLabels[box.tier]} Drop</h2>
                    <p className="text-sm text-muted-foreground mt-2">{box.reward_label ?? `Level ${box.level_number} reward crate`}</p>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background/30 animate-float"><Icon className={box.tier === "legendary" ? "h-7 w-7 text-warning" : "h-7 w-7 text-secondary"} /></div>
                </div>
                <button onClick={() => setActiveId(box.id)} className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Open sequence</button>
              </GlassCard>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Boxes;
