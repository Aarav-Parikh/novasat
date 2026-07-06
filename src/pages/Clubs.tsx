import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Users2, Plus, LogIn } from "lucide-react";

type Club = { id: string; name: string; slug: string; join_code: string };

export default function Clubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function load() {
    const { data } = await supabase.from("clubs").select("id,name,slug,join_code");
    setClubs((data as Club[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const { data } = await supabase.rpc("create_club", { _name: name.trim() });
    const r = data as { ok: boolean; reason?: string } | null;
    if (r?.ok) { toast({ title: "Club created" }); setName(""); load(); }
    else toast({ title: "Couldn't create", description: r?.reason });
  }
  async function join() {
    if (!code.trim()) return;
    const { data } = await supabase.rpc("join_club", { _join_code: code.trim() });
    const r = data as { ok: boolean; reason?: string } | null;
    if (r?.ok) { toast({ title: "Joined" }); setCode(""); load(); }
    else toast({ title: "Couldn't join", description: r?.reason });
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Social</span>
        <h1 className="font-display text-4xl font-bold">Clubs</h1>
        <p className="text-sm text-muted-foreground mt-1">Study groups with their own leaderboard.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GlassCard>
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Plus className="h-4 w-4" /> Create club</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm mb-2" />
          <button onClick={create} className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold">Create</button>
        </GlassCard>
        <GlassCard>
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><LogIn className="h-4 w-4" /> Join by code</h3>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6-char code" maxLength={6} className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm mb-2 font-mono" />
          <button onClick={join} className="w-full px-4 py-2 rounded-lg bg-muted/40 border border-border text-sm">Join</button>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Users2 className="h-4 w-4" /> Your clubs</h3>
        {clubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren't in any clubs yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {clubs.map((c) => (
              <li key={c.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Join code: <span className="font-mono">{c.join_code}</span></div>
                </div>
                <Link to={`/clubs/${c.slug}`} state={{ id: c.id }} className="text-xs px-3 py-1.5 rounded-md bg-primary/15 text-primary border border-primary/30">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </AppLayout>
  );
}
