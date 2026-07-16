import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Avatar } from "@/components/Avatar";
import { UserPlus, Check, X, Users, Search, Sparkles, Undo2, Flame, Zap } from "lucide-react";

type Friend = {
  friendship_id: string;
  friend_id: string;
  display_name: string | null;
  avatar_url: string | null;
  status: "pending" | "accepted";
  direction: "outgoing" | "incoming";
  xp: number;
  streak: number;
  weekly_xp: number;
};

type Suggested = { user_id: string; display_name: string | null; avatar_url: string | null; xp: number; streak: number };

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

  async function cancel(id: string) {
    await supabase.rpc("cancel_friend_request", { _id: id });
    toast({ title: "Request cancelled" });
    loadFriends(); loadSuggested();
  }

  const incoming = friends.filter((f) => f.status === "pending" && f.direction === "incoming");
  const outgoing = friends.filter((f) => f.status === "pending" && f.direction === "outgoing");
  const accepted = friends.filter((f) => f.status === "accepted");

  return (
    <AppLayout>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Social</span>
        <h1 className="font-display text-4xl font-bold">Friends</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">Study together. Push each other's streaks. Compete on the leaderboard.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GlassCard>
          <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Search className="h-3 w-3" /> Find by username</label>
          <div className="mt-3 flex gap-2">
            <input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="e.g. novacadet"
              onKeyDown={(e) => e.key === "Enter" && sendByName()}
              className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            <button onClick={sendByName} disabled={loading || !nameQuery.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-40">
              <UserPlus className="h-4 w-4" /> Send
            </button>
          </div>
        </GlassCard>
        <GlassCard>
          <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Search className="h-3 w-3" /> Find by email</label>
          <div className="mt-3 flex gap-2">
            <input value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} placeholder="friend@example.com" type="email"
              onKeyDown={(e) => e.key === "Enter" && sendByEmail()}
              className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            <button onClick={sendByEmail} disabled={loading || !emailQuery.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-40">
              <UserPlus className="h-4 w-4" /> Send
            </button>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
        <div className="space-y-6">
          {incoming.length > 0 && (
            <GlassCard variant="cyan">
              <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-secondary" /> Incoming requests
                <span className="ml-auto text-xs font-mono text-muted-foreground">{incoming.length}</span>
              </h3>
              <ul className="space-y-2">
                {incoming.map((f) => (
                  <li key={f.friendship_id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/60">
                    <Avatar name={f.display_name} url={f.avatar_url} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{f.display_name || "Unknown"}</div>
                      <div className="text-[11px] text-muted-foreground">wants to be your study buddy</div>
                    </div>
                    <button onClick={() => respond(f.friendship_id, true)} title="Accept"
                      className="h-9 w-9 flex items-center justify-center rounded-lg bg-success/20 text-success hover:bg-success/30 transition">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => respond(f.friendship_id, false)} title="Decline"
                      className="h-9 w-9 flex items-center justify-center rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          <GlassCard>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" /> Your friends
              <span className="ml-auto text-xs font-mono text-muted-foreground">{accepted.length}</span>
            </h3>
            {accepted.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No friends yet — search for a username above or add someone from Suggested cadets.
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {accepted.map((f) => (
                  <li key={f.friendship_id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/60">
                    <Avatar name={f.display_name} url={f.avatar_url} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{f.display_name || "Unknown"}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-warning" /> {f.streak}d</span>
                        <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 text-secondary" /> {f.weekly_xp.toLocaleString()} XP wk</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          {outgoing.length > 0 && (
            <GlassCard>
              <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" /> Requests sent
                <span className="ml-auto text-xs font-mono text-muted-foreground">{outgoing.length}</span>
              </h3>
              <ul className="space-y-2">
                {outgoing.map((f) => (
                  <li key={f.friendship_id} className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/60">
                    <Avatar name={f.display_name} url={f.avatar_url} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{f.display_name || "Unknown"}</div>
                      <div className="text-[11px] text-muted-foreground">Waiting for reply…</div>
                    </div>
                    <button onClick={() => cancel(f.friendship_id)}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-muted/40 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition">
                      <Undo2 className="h-3.5 w-3.5" /> Undo
                    </button>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>

        <GlassCard variant="purple">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-secondary" /> Suggested cadets
          </h3>
          {suggested.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one to suggest right now — check back later.</p>
          ) : (
            <ul className="space-y-2">
              {suggested.map((s) => {
                const requested = pendingIds.has(s.user_id);
                return (
                  <li key={s.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/60">
                    <Avatar name={s.display_name} url={s.avatar_url} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.display_name || "Cadet"}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <Flame className="h-3 w-3 text-warning" /> {s.streak}d
                        <span>·</span>
                        <span>{s.xp.toLocaleString()} XP</span>
                      </div>
                    </div>
                    <button onClick={() => sendToSuggested(s)} disabled={requested}
                      className="text-xs px-3 py-1.5 rounded-md bg-secondary/15 border border-secondary/40 text-secondary hover:bg-secondary/25 disabled:opacity-50">
                      {requested ? "Sent" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>
    </AppLayout>
  );
}

function reason(r?: string): string | undefined {
  if (!r) return undefined;
  const map: Record<string, string> = {
    not_found: "No user with that username/email.",
    self: "That's you.",
    exists: "You've already sent or received a request.",
  };
  return map[r] ?? r;
}
