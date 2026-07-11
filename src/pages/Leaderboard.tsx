import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame } from "lucide-react";

type Row = { user_id: string; display_name: string | null; weekly_xp: number; streak: number };

export default function Leaderboard() {
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc("leaderboard_top", { _scope: scope, _limit: 50 });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [scope]);

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Compete</span>
        <h1 className="font-display text-4xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Weekly XP earned in the last 7 days.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(["global", "friends"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-4 py-2 rounded-lg text-sm capitalize ${
              scope === s ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground" : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <GlassCard>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No entries yet.</div>
        ) : (
          <ol className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <li key={r.user_id} className="flex items-center gap-4 py-3">
                <div className={`w-8 text-center font-display font-bold ${i < 3 ? "text-secondary" : "text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.display_name?.trim() || "Cadet"}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Flame className="h-3 w-3 text-warning" /> {r.streak} day streak
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-mono">
                  <Trophy className="h-3.5 w-3.5 text-secondary" />
                  {r.weekly_xp.toLocaleString()} XP
                </div>
              </li>
            ))}
          </ol>
        )}
      </GlassCard>
    </AppLayout>
  );
}
