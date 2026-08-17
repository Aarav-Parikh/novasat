import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Gem, Sparkles, Target, Trophy } from "lucide-react";

type Quest = {
  key: string;
  label: string;
  desc: string;
  goal: number;
  progress: number;
  reward_sp: number;
  kind: "daily" | "weekly";
  unit?: "seconds";
};

type QuestData = {
  day_key: string;
  week_key: string;
  daily: Quest[];
  weekly: Quest[];
  claimed: { quest_key: string; period_key: string }[];
};

function fmt(q: Quest) {
  if (q.unit === "seconds") return `${Math.floor(q.progress / 60)} / ${Math.floor(q.goal / 60)} min`;
  return `${q.progress} / ${q.goal}`;
}

export default function Quests() {
  const [data, setData] = useState<QuestData | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    const { data: raw } = await supabase.rpc("list_quests");
    setData(raw as unknown as QuestData);
  };
  useEffect(() => { load(); }, []);

  const claim = async (q: Quest) => {
    setClaiming(q.key);
    const { data: raw, error } = await supabase.rpc("claim_quest", { _quest_key: q.key });
    setClaiming(null);
    const res = raw as { ok: boolean; reason?: string; reward_sp?: number } | null;
    if (error || !res?.ok) {
      toast({ title: "Not yet", description: res?.reason === "incomplete" ? "Finish the quest first." : res?.reason ?? error?.message });
      return;
    }
    toast({ title: `+${res.reward_sp} SP claimed`, description: q.label });
    load();
  };

  const renderList = (quests: Quest[], periodKey: string) => (
    <ul className="grid md:grid-cols-2 gap-4">
      {quests.map((q) => {
        const complete = q.progress >= q.goal;
        const claimed = data?.claimed.some((c) => c.quest_key === q.key && c.period_key === periodKey);
        const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
        return (
          <li key={q.key} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-semibold">{q.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{q.desc}</div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 border border-secondary/40 px-2 py-0.5 text-xs font-mono text-secondary shrink-0">
                <Gem className="h-3 w-3" /> +{q.reward_sp}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${complete ? "bg-success" : "bg-gradient-to-r from-primary to-secondary"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono tabular-nums">{fmt(q)}</span>
            </div>
            <button
              onClick={() => claim(q)}
              disabled={!complete || !!claimed || claiming === q.key}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimed ? (<><CheckCircle2 className="h-4 w-4" /> Claimed</>) : complete ? `Claim ${q.reward_sp} SP` : "In progress"}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Missions</span>
        <h1 className="font-display text-4xl font-bold">Quests</h1>
        <p className="text-muted-foreground mt-2">Complete quests to stack SP. Daily quests reset every day; weekly quests reset each Monday.</p>
      </div>

      <GlassCard data-page-section="How SP Works" variant="cyan" className="mb-6">
        <div className="flex items-center gap-2 text-secondary text-xs uppercase tracking-[0.25em]">
          <Sparkles className="h-3.5 w-3.5" /> How SP works
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          SP is your currency for Buddy's cosmetics in the Store. Earn it from quests, daily login, and finished practice sessions.
          Keep Buddy in the Energetic mood for a 1.2× multiplier on session SP.
        </p>
      </GlassCard>

      <GlassCard data-page-section="Daily Quests" className="mb-6">
        <h2 className="font-display text-2xl font-semibold flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" /> Daily quests
        </h2>
        {data ? renderList(data.daily, data.day_key) : <div className="text-sm text-muted-foreground">Loading…</div>}
      </GlassCard>

      <GlassCard data-page-section="Weekly Quests" variant="purple">
        <h2 className="font-display text-2xl font-semibold flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-secondary" /> Weekly quests
        </h2>
        {data ? renderList(data.weekly, data.week_key) : <div className="text-sm text-muted-foreground">Loading…</div>}
      </GlassCard>
    </AppLayout>
  );
}
