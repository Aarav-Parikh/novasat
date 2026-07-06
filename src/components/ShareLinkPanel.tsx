import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Share2, Copy, Link2Off } from "lucide-react";

type Share = { id: string; slug: string; is_active: boolean; created_at: string };

export function ShareLinkPanel() {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase.from("progress_shares").select("id,slug,is_active,created_at").order("created_at", { ascending: false });
    setShares((data as Share[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setLoading(true);
    const { data } = await supabase.rpc("create_share_link");
    setLoading(false);
    if ((data as any)?.ok) { toast({ title: "Share link created" }); load(); }
  }
  async function revoke(id: string) {
    await supabase.rpc("revoke_share_link", { _id: id });
    load();
  }
  function copy(slug: string) {
    const url = `${window.location.origin}/share/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: url });
  }

  const active = shares.filter((s) => s.is_active);

  return (
    <GlassCard>
      <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Share2 className="h-5 w-5" /> Parent / tutor share</h2>
      <p className="text-sm text-muted-foreground mt-1">Share a read-only progress page. No sign-in required for viewers. Revoke anytime.</p>
      <button onClick={create} disabled={loading} className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold">
        Create share link
      </button>
      {active.length > 0 && (
        <ul className="mt-4 space-y-2">
          {active.map((s) => (
            <li key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-border">
              <code className="flex-1 text-xs truncate">/share/{s.slug}</code>
              <button onClick={() => copy(s.slug)} className="p-2 rounded-md bg-muted/40" aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button>
              <button onClick={() => revoke(s.id)} className="p-2 rounded-md bg-destructive/20 text-destructive" aria-label="Revoke"><Link2Off className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
