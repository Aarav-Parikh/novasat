import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cookie, Heart, Moon, Sparkles, Sun, ChevronRight, Loader2, CircleCheck as CheckCircle2, Circle as XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import {
  useNova,
  computeCurrentEnergy,
  moodForEnergy,
  spMultiplierFromPet,
  COSMETIC_CATALOG,
  CosmeticSlot,
  PetMood,
} from "@/lib/novaprep-store";
import { toast } from "@/hooks/use-toast";
import { generateQuestions } from "@/lib/generate-questions";
import { Question } from "@/lib/novaprep-data";
import petEnergeticImg from "@/assets/pet-energetic.png";
import petTiredImg from "@/assets/pet-tired.png";
import petAsleepImg from "@/assets/pet-asleep.png";

const moodCopy: Record<PetMood, { title: string; subtitle: string }> = {
  energetic: {
    title: "Bright-eyed and bouncing",
    subtitle: "Buddy is happy and alert. You're earning a 20% SP bonus on everything.",
  },
  tired: {
    title: "Getting sleepy…",
    subtitle: "Buddy is resting their head on their paws. Feed them treats to perk them up.",
  },
  asleep: {
    title: "Fast asleep",
    subtitle: "Buddy zonked out. Complete a 10-question Wake-Up Quiz to revive them.",
  },
};

const moodImg: Record<PetMood, string> = {
  energetic: petEnergeticImg,
  tired: petTiredImg,
  asleep: petAsleepImg,
};

const moodAccent: Record<PetMood, string> = {
  energetic: "from-success/30 to-success/5 border-success/40",
  tired: "from-warning/25 to-warning/5 border-warning/40",
  asleep: "from-primary/25 to-primary/5 border-primary/40",
};

const slotLabel: Record<CosmeticSlot, string> = {
  hat: "Hat",
  neck: "Neck",
  outfit: "Outfit",
};

const Pet = () => {
  const profile = useNova((s) => s.profile);
  const feedPet = useNova((s) => s.feedPet);
  const equipCosmetic = useNova((s) => s.equipCosmetic);
  const syncPetDecay = useNova((s) => s.syncPetDecay);
  const nav = useNavigate();
  const [, force] = useState(0);
  const [feeding, setFeeding] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  // Tick the energy display every 30s and persist if drift > 1%
  useEffect(() => {
    const t = window.setInterval(() => {
      force((n) => n + 1);
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Persist decay on mount
  useEffect(() => {
    syncPetDecay();
  }, [syncPetDecay]);

  const energy = profile
    ? computeCurrentEnergy(profile.pet_energy, profile.pet_last_decay_at)
    : 0;
  const mood = moodForEnergy(energy);
  const treats = profile?.treats ?? 0;
  const mult = spMultiplierFromPet(mood);

  const onFeedOne = async () => {
    if (treats < 1) return;
    if (mood === "asleep") {
      toast({
        title: "Buddy is asleep",
        description: "Complete the Wake-Up Quiz to revive them before feeding.",
        variant: "destructive",
      });
      return;
    }
    setFeeding(true);
    const ok = await feedPet(1);
    setFeeding(false);
    if (ok) {
      toast({ title: "+5% energy", description: "Yum! Buddy munched a treat." });
    }
  };

  const equippedHat = profile?.equipped.hat;
  const equippedNeck = profile?.equipped.neck;
  const equippedOutfit = profile?.equipped.outfit;
  const equippedItems = [equippedHat, equippedNeck, equippedOutfit]
    .map((id) => (id ? COSMETIC_CATALOG.find((c) => c.id === id) : null))
    .filter(Boolean);

  const ownedBySlot = useMemo(() => {
    const owned = profile?.cosmetics ?? [];
    return (["hat", "neck", "outfit"] as CosmeticSlot[]).map((slot) => ({
      slot,
      items: COSMETIC_CATALOG.filter(
        (c) => c.slot === slot && owned.includes(c.id),
      ),
    }));
  }, [profile?.cosmetics]);

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">
            Companion
          </span>
          <h1 className="font-display text-4xl font-bold mt-1">Buddy the Study Pup</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Feed Buddy <span className="text-foreground font-medium">Crunchy Treats</span> to
            keep their energy up. Energy drops 25% every 24 hours — keep them in the
            Energetic zone for a <span className="text-success font-medium">20% SP bonus</span>{" "}
            on everything you earn.
          </p>
        </div>
        <div className="glass px-4 py-3 text-sm inline-flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-secondary" />
          <span className="font-mono text-secondary">
            SP Multiplier: <span className="text-foreground">{mult.toFixed(1)}×</span>
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
        {/* LEFT: Treats inventory */}
        <GlassCard variant="cyan" className="!p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-warning" />
              <h2 className="font-display text-xl font-semibold">Treat Pantry</h2>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              Earn 1 per 5 correct
            </span>
          </div>

          <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/15 to-warning/5 p-6 text-center">
            <div className="text-7xl mb-2 leading-none">🍪</div>
            <div className="font-display text-5xl font-bold tabular-nums">
              {treats}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
              Crunchy Treats · +5% energy each
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <button
              onClick={onFeedOne}
              disabled={treats < 1 || feeding || mood === "asleep"}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-warning to-warning/70 px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Cookie className="h-4 w-4" />
              {feeding ? "Feeding…" : "Feed 1 Treat (+5%)"}
            </button>
            {treats >= 5 && mood !== "asleep" && (
              <button
                onClick={async () => {
                  const n = Math.min(treats, Math.ceil((100 - energy) / 5));
                  if (n < 1) return;
                  setFeeding(true);
                  const ok = await feedPet(n);
                  setFeeding(false);
                  if (ok)
                    toast({
                      title: `+${n * 5}% energy`,
                      description: `Buddy chowed down ${n} treats.`,
                    });
                }}
                disabled={feeding || energy >= 100}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm font-medium text-warning disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Top off to 100%
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            No treats? Run a drill or full simulation in Practice — every 5 correct
            answers earns one when you submit.
          </p>
        </GlassCard>

        {/* RIGHT: Pet display */}
        <GlassCard
          variant="purple"
          className={`!p-6 bg-gradient-to-br ${moodAccent[mood]}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-[0.25em] text-secondary inline-flex items-center gap-1.5">
              {mood === "energetic" && <Sun className="h-3.5 w-3.5" />}
              {mood === "tired" && <Heart className="h-3.5 w-3.5" />}
              {mood === "asleep" && <Moon className="h-3.5 w-3.5" />}
              {mood}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Status
            </span>
          </div>

          <div className="relative mx-auto w-full max-w-sm aspect-square flex items-center justify-center">
            <img
              src={moodImg[mood]}
              alt={`Buddy looking ${mood}`}
              width={512}
              height={512}
              loading="lazy"
              className={`w-full h-full object-contain drop-shadow-[0_10px_40px_hsl(var(--primary)/0.35)] ${
                mood === "energetic" ? "animate-float" : ""
              }`}
            />
            {/* Cosmetic chips overlay */}
            {equippedItems.length > 0 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {equippedItems.map(
                  (c) =>
                    c && (
                      <span
                        key={c.id}
                        className="text-xl rounded-full bg-background/70 backdrop-blur px-2 py-1 border border-border"
                        title={c.label}
                      >
                        {c.emoji}
                      </span>
                    ),
                )}
              </div>
            )}
          </div>

          {/* Energy bar */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Energy
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums">
                {Math.round(energy)}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  mood === "energetic"
                    ? "bg-gradient-to-r from-success to-success/70"
                    : mood === "tired"
                    ? "bg-gradient-to-r from-warning to-warning/70"
                    : "bg-gradient-to-r from-destructive to-destructive/70"
                }`}
                style={{ width: `${Math.max(2, energy)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              <span>Asleep · 0–24</span>
              <span>Tired · 25–74</span>
              <span>Energetic · 75–100</span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-background/40 p-4">
            <h3 className="font-display text-lg font-semibold">
              {moodCopy[mood].title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {moodCopy[mood].subtitle}
            </p>
            {mood === "asleep" && (
              <button
                onClick={() => setQuizOpen(true)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Start Wake-Up Quiz <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Wardrobe */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Wardrobe</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Equip cosmetics you've bought. Visit the Store to buy more with SP.
            </p>
          </div>
          <button
            onClick={() => nav("/store")}
            className="text-xs px-3 py-2 rounded-lg border border-secondary/40 text-secondary hover:bg-secondary/10"
          >
            Browse Store →
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {ownedBySlot.map(({ slot, items }) => {
            const equippedId =
              slot === "hat"
                ? equippedHat
                : slot === "neck"
                ? equippedNeck
                : equippedOutfit;
            return (
              <GlassCard key={slot} className="!p-5">
                <div className="text-xs uppercase tracking-widest text-secondary">
                  {slotLabel[slot]}
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-3">
                    Nothing in this slot yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {items.map((item) => {
                      const equipped = equippedId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() =>
                            equipCosmetic(slot, equipped ? null : item.id)
                          }
                          className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                            equipped
                              ? "border-primary/60 bg-primary/10"
                              : "border-border bg-background/40 hover:border-secondary/40"
                          }`}
                        >
                          <span className="text-2xl">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {item.label}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {equipped ? "Equipped · tap to remove" : "Tap to equip"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>

      {quizOpen && <WakeUpQuiz onClose={() => setQuizOpen(false)} />}
    </AppLayout>
  );
};

// -------- Wake-Up Quiz --------

function WakeUpQuiz({ onClose }: { onClose: () => void }) {
  const feedPet = useNova((s) => s.feedPet);
  const profile = useNova((s) => s.profile);
  const syncProfile = useNova((s) => s.syncProfile);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [revived, setRevived] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = await generateQuestions({
          mode: "redemption",
          count: 10,
          difficultyBias: "easier",
        });
        if (!cancelled) {
          setQuestions(qs.slice(0, 10));
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: "Couldn't load quiz",
            description: e?.message ?? "Try again in a moment.",
            variant: "destructive",
          });
          onCloseRef.current();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally run only once on mount — onClose changes each parent render
    // and would otherwise re-trigger question generation mid-quiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = questions[idx];
  const allAnswered = questions.length > 0 && questions.every((qq) => answers[qq.id] !== undefined);

  const submit = async () => {
    setDone(true);
    setReviving(true);
    // Revive Buddy regardless of score (it's a wake-up, not a grade)
    const profileNow = useNova.getState().profile;
    if (profileNow) {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase
        .from("profiles")
        .update({
          pet_energy: 100,
          pet_last_decay_at: new Date().toISOString(),
        })
        .eq("id", profileNow.id);
      await syncProfile();
    }
    setReviving(false);
    setRevived(true);
  };

  const correctCount = questions.filter(
    (qq) => answers[qq.id] === qq.correct,
  ).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-xl p-4 animate-fade-in">
      <div className="glass glass-purple max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-7 w-7 text-secondary animate-spin" />
            <div className="text-sm text-muted-foreground">
              Brewing 10 wake-up questions…
            </div>
          </div>
        ) : revived ? (
          <div className="text-center py-4">
            <div className="text-6xl mb-3">🌟</div>
            <h2 className="font-display text-3xl font-bold">Buddy is wide awake!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              You got {correctCount} of {questions.length} correct. Energy
              restored to 100%.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Back to pet
            </button>
          </div>
        ) : !done ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-[0.25em] text-secondary">
                Wake-Up Quiz · {idx + 1}/{questions.length}
              </span>
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="h-1 rounded-full bg-muted mb-5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
              />
            </div>

            {q && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  {q.section} · {q.topic}
                </div>
                {q.passage && (
                  <div className="glass p-4 mb-4 text-sm leading-relaxed">
                    {q.passage}
                  </div>
                )}
                <h2 className="font-display text-lg font-semibold leading-snug">
                  {q.prompt}
                </h2>
                <div className="mt-4 space-y-2">
                  {q.choices.map((c, i) => {
                    const isSel = answers[q.id] === i;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setAnswers((a) => ({ ...a, [q.id]: i }))
                        }
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all flex items-start gap-3 ${
                          isSel
                            ? "border-primary/60 bg-primary/10"
                            : "border-border bg-muted/30 hover:border-secondary/40"
                        }`}
                      >
                        <span className="font-mono text-xs text-muted-foreground mt-0.5">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{c}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    disabled={idx === 0}
                    className="px-4 py-2.5 rounded-lg border border-border bg-muted/30 text-sm font-medium disabled:opacity-40"
                  >
                    Back
                  </button>
                  {idx < questions.length - 1 ? (
                    <button
                      onClick={() => setIdx((i) => i + 1)}
                      disabled={answers[q.id] === undefined}
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-40"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={submit}
                      disabled={!allAnswered}
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-40"
                    >
                      Wake Buddy up
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-7 w-7 text-secondary animate-spin" />
            <div className="text-sm text-muted-foreground">
              {reviving ? "Reviving Buddy…" : "Wrapping up…"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pet;
