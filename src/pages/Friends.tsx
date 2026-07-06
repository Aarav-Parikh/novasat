import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Check, X, Users } from "lucide-react";

type Friend = {
  friendship_id: string;
  friend_id: string;
  display_name: string | null;
  status: "pending" | "accepted";
  direction: "outgoing" | "incoming";
  xp: number;
  streak: number;
  weekly_xp: number;
};

export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase.rpc("list_friends");
    setFriends((data as Friend[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function send() {
    if (!name.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("send_friend_request", { _display_name: name.trim() });
    setLoading(false);
    const res = data as { ok: boolean; reason?: string } | null;
    if (error || !res?.ok) {
      toast({ title: "Couldn't send request", description: res?.reason ?? error?.message });
    } else {
      toast({ title: "Request sent" });
      setName("");
      load();
    }
  }

  async function respond(id: string, accept: boolean) {
    await supabase.rpc("respond_friend_request", { _id: id, _accept: accept });
    load();
  }

  const incoming = friends.filter((f) => f.status === "pending" && f.direction === "incoming");
  const outgoing = friends.filter((f) => f.status === "pending" && f.direction === "outgoing");
  const accepted = friends.filter((f) => f.status === "accepted");

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Social</span>
        <h1 className="font-display text-4xl font-bold">Friends</h1>
      </div>

      <GlassCard className="mb-6">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's display name"
            className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold"
          >
            <UserPlus className="h-4 w-4" /> Add
          </button>
        </div>
      </GlassCard>

      {incoming.length > 0 && (
        <GlassCard className="mb-6">
          <h3 className="font-display font-semibold mb-3">Requests</h3>
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-3 p-2 rounded-lg bg-background/40">
                <div className="flex-1">{f.display_name || "Unknown"}</div>
                <button onClick={() => respond(f.friendship_id, true)} className="p-2 rounded-md bg-success/20 text-success"><Check className="h-4 w-4" /></button>
                <button onClick={() => respond(f.friendship_id, false)} className="p-2 rounded-md bg-destructive/20 text-destructive"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <GlassCard>
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Your friends</h3>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet — add someone above.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {accepted.map((f) => (
              <li key={f.friendship_id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.display_name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">🔥 {f.streak}d · {f.weekly_xp.toLocaleString()} XP this week</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {outgoing.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            Pending sent: {outgoing.map((f) => f.display_name).join(", ")}
          </div>
        )}
      </GlassCard>
    </AppLayout>
  );
}
