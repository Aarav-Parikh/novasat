import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";

type Row = { user_id: string; display_name: string | null; weekly_xp: number; streak: number };

export default function ClubDetail() {
  const { slug } = useParams();
  const { state } = useLocation() as { state?: { id?: string } };
  const [name, setName] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data: club } = await supabase.from("clubs").select("id,name").eq("slug", slug!).maybeSingle();
      const id = (club?.id as string) ?? state?.id;
      if (club?.name) setName(club.name as string);
      if (!id) return;
      const { data } = await supabase.rpc("club_leaderboard", { _club_id: id });
      setRows((data as Row[]) ?? []);
    })();
  }, [slug, state?.id]);

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Club</span>
        <h1 className="font-display text-4xl font-bold">{name || "Club"}</h1>
      </div>
      <GlassCard>
        <h3 className="font-display font-semibold mb-3">Weekly leaderboard</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ol className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <li key={r.user_id} className="flex items-center gap-4 py-3">
                <div className="w-6 text-center font-display font-bold text-muted-foreground">{i + 1}</div>
                <div className="flex-1">{r.display_name || "Anon"}</div>
                <div className="text-xs text-muted-foreground">🔥 {r.streak}d</div>
                <div className="text-sm font-mono">{r.weekly_xp.toLocaleString()} XP</div>
              </li>
            ))}
          </ol>
        )}
      </GlassCard>
    </AppLayout>
  );
}
