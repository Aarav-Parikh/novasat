import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Check, X, Users, Search, Sparkles } from "lucide-react";

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

type Suggested = { user_id: string; display_name: string | null; xp: number; streak: number };

export default function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function loadFriends() {
    const { data } = await supabase.rpc("list_friends");
    setFriends((data as Friend[]) ?? []);
  }
  async function loadSuggested() {
    const { data } = await supabase.rpc("suggested_users", { _limit: 8 });
    setSuggested((data as Suggested[]) ?? []);
  }

  useEffect(() => { loadFriends(); loadSuggested(); }, [user?.id]);

  async function sendByName() {
    if (!nameQuery.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("send_friend_request", { _display_name: nameQuery.trim() });
    setLoading(false);
    const res = data as { ok: boolean; reason?: string } | null;
    if (error || !res?.ok) {
      toast({ title: "Couldn't send request", description: reason(res?.reason) ?? error?.message, variant: "destructive" });
    } else {
      toast({ title: "Friend request sent", description: `We let ${nameQuery.trim()} know.` });
      setNameQuery("");
      loadFriends(); loadSuggested();
    }
  }

  async function sendByEmail() {
    if (!emailQuery.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("send_friend_request_by_email", { _email: emailQuery.trim() });
    setLoading(false);
    const res = data as { ok: boolean; reason?: string } | null;
    if (error || !res?.ok) {
      toast({ title: "Couldn't send request", description: reason(res?.reason) ?? error?.message, variant: "destructive" });
    } else {
      toast({ title: "Friend request sent" });
      setEmailQuery("");
      loadFriends(); loadSuggested();
    }
  }

  async function sendToSuggested(s: Suggested) {
    if (!s.display_name) return;
    setPendingIds((p) => new Set(p).add(s.user_id));
    const { data, error } = await supabase.rpc("send_friend_request", { _display_name: s.display_name });
    const res = data as { ok: boolean; reason?: string } | null;
    if (error || !res?.ok) {
      toast({ title: "Couldn't send request", description: reason(res?.reason) ?? error?.message, variant: "destructive" });
      setPendingIds((p) => { const n = new Set(p); n.delete(s.user_id); return n; });
    } else {
      toast({ title: "Friend request sent", description: s.display_name });
      loadFriends();
    }
  }

  async function respond(id: string, accept: boolean) {
    await supabase.rpc("respond_friend_request", { _id: id, _accept: accept });
    toast({ title: accept ? "Friend added" : "Request dismissed" });
    loadFriends();
  }

  const incoming = friends.filter((f) => f.status === "pending" && f.direction === "incoming");
  const outgoing = friends.filter((f) => f.status === "pending" && f.direction === "outgoing");
  const accepted = friends.filter((f) => f.status === "accepted");

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Social</span>
        <h1 className="font-display text-4xl font-bold">Friends</h1>
        <p className="text-muted-foreground mt-2">Study together. Push each other's streaks. Compete on the leaderboard.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GlassCard>
          <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Search className="h-3 w-3" /> Find by username</label>
          <div className="mt-2 flex gap-2">
            <input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="e.g. novacadet"
              className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            <button onClick={sendByName} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-60">
              <UserPlus className="h-4 w-4" /> Send
            </button>
          </div>
        </GlassCard>
        <GlassCard>
          <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Search className="h-3 w-3" /> Find by email</label>
          <div className="mt-2 flex gap-2">
            <input value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} placeholder="friend@example.com" type="email"
              className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            <button onClick={sendByEmail} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-60">
              <UserPlus className="h-4 w-4" /> Send
            </button>
          </div>
        </GlassCard>
      </div>

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

      {suggested.length > 0 && (
        <GlassCard variant="purple" className="mb-6">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-secondary" /> Suggested cadets</h3>
          <ul className="grid sm:grid-cols-2 gap-2">
            {suggested.map((s) => {
              const requested = pendingIds.has(s.user_id);
              return (
                <li key={s.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.display_name || "Cadet"}</div>
                    <div className="text-xs text-muted-foreground">🔥 {s.streak}d · {s.xp.toLocaleString()} XP</div>
                  </div>
                  <button onClick={() => sendToSuggested(s)} disabled={requested}
                    className="text-xs px-3 py-1.5 rounded-md bg-secondary/15 border border-secondary/40 text-secondary hover:bg-secondary/25 disabled:opacity-60">
                    {requested ? "Sent" : "Add"}
                  </button>
                </li>
              );
            })}
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

function reason(r?: string): string | undefined {
  if (!r) return undefined;
  const map: Record<string, string> = {
    not_found: "No user with that username/email.",
    self: "That's you.",
    exists: "You've already sent or received a request.",
    child_not_found: "No student found with that email.",
    not_parent: "This action is for parent accounts only.",
  };
  return map[r] ?? r;
}
