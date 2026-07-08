import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Check, X, Users, Swords, Loader2 } from "lucide-react";
import { generateQuestions } from "@/lib/generate-questions";

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

type DuelRow = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  section: string;
  status: "pending" | "active" | "complete";
  challenger_name?: string | null;
  opponent_name?: string | null;
};

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [duels, setDuels] = useState<DuelRow[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengingId, setChallengingId] = useState<string | null>(null);

  async function loadFriends() {
    const { data } = await supabase.rpc("list_friends");
    setFriends((data as Friend[]) ?? []);
  }
  async function loadDuels() {
    if (!user?.id) return;
    const { data } = await supabase
      .from("duels")
      .select("id,challenger_id,opponent_id,section,status")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .neq("status", "complete")
      .order("created_at", { ascending: false });
    if (!data?.length) { setDuels([]); return; }
    const ids = Array.from(new Set(data.flatMap((d) => [d.challenger_id, d.opponent_id])));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", ids);
    const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
    setDuels(
      data.map((d) => ({
        ...d,
        status: d.status as DuelRow["status"],
        challenger_name: nameById.get(d.challenger_id) ?? null,
        opponent_name: nameById.get(d.opponent_id) ?? null,
      })),
    );
  }

  useEffect(() => { loadFriends(); loadDuels(); }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`duels-user-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, () => loadDuels())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

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
      loadFriends();
    }
  }

  async function respond(id: string, accept: boolean) {
    await supabase.rpc("respond_friend_request", { _id: id, _accept: accept });
    loadFriends();
  }

  async function challenge(friend: Friend, section: "Math" | "Reading & Writing") {
    if (!friend.display_name) {
      toast({ title: "Friend has no display name yet." });
      return;
    }
    setChallengingId(friend.friend_id);
    try {
      const mode = section === "Math" ? "math" : "reading";
      const qs = await generateQuestions({ mode, count: 5, difficultyBias: "balanced" });
      if (!qs.length) throw new Error("No questions generated");
      const payload = qs.slice(0, 5).map((q) => ({
        prompt: q.prompt,
        passage: q.passage ?? null,
        choices: q.choices,
        correct: q.correct,
        topic: q.topic,
        section: q.section,
      }));
      const { data, error } = await supabase.rpc("create_duel", {
        _opponent_display_name: friend.display_name,
        _questions: payload as any,
        _section: section,
      });
      const res = data as { ok: boolean; duel_id?: string; reason?: string } | null;
      if (error || !res?.ok || !res.duel_id) {
        toast({ title: "Couldn't start duel", description: res?.reason ?? error?.message });
        return;
      }
      toast({ title: "Duel created — good luck!" });
      navigate(`/duel/${res.duel_id}`);
    } catch (e: any) {
      toast({ title: "Duel setup failed", description: e?.message ?? "Try again in a moment." });
    } finally {
      setChallengingId(null);
    }
  }

  const incoming = friends.filter((f) => f.status === "pending" && f.direction === "incoming");
  const outgoing = friends.filter((f) => f.status === "pending" && f.direction === "outgoing");
  const accepted = friends.filter((f) => f.status === "accepted");

  const activeDuels = duels.filter((d) => d.status === "active");
  const pendingDuels = duels.filter((d) => d.status === "pending");

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Social</span>
        <h1 className="font-display text-4xl font-bold">Friends</h1>
        <p className="text-muted-foreground mt-2">Add friends, race in 5-question duels, and push each other's streaks.</p>
      </div>

      {(activeDuels.length > 0 || pendingDuels.length > 0) && (
        <GlassCard variant="purple" className="mb-6">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Swords className="h-4 w-4 text-secondary" /> Your duels
          </h3>
          <ul className="space-y-2">
            {activeDuels.map((d) => {
              const oppName = user?.id === d.challenger_id ? d.opponent_name : d.challenger_name;
              return (
                <li key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">vs {oppName || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{d.section} · in progress</div>
                  </div>
                  <button
                    onClick={() => navigate(`/duel/${d.id}`)}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary/15 text-primary-glow border border-primary/30 hover:bg-primary/25 transition-colors"
                  >
                    Continue
                  </button>
                </li>
              );
            })}
            {pendingDuels.map((d) => {
              const isChallenger = user?.id === d.challenger_id;
              const oppName = isChallenger ? d.opponent_name : d.challenger_name;
              return (
                <li key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {isChallenger ? `Waiting on ${oppName || "opponent"}` : `Challenged by ${oppName || "friend"}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.section} · 5 questions</div>
                  </div>
                  {!isChallenger && (
                    <button
                      onClick={() => navigate(`/duel/${d.id}`)}
                      className="text-xs px-3 py-1.5 rounded-md bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold"
                    >
                      Accept
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}

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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-60"
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
            {accepted.map((f) => {
              const isChallenging = challengingId === f.friend_id;
              return (
                <li key={f.friendship_id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium truncate">{f.display_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">🔥 {f.streak}d · {f.weekly_xp.toLocaleString()} XP this week</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => challenge(f, "Math")}
                      disabled={isChallenging}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary/20 disabled:opacity-60"
                    >
                      {isChallenging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Swords className="h-3 w-3" />}
                      Math
                    </button>
                    <button
                      onClick={() => challenge(f, "Reading & Writing")}
                      disabled={isChallenging}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-primary/40 bg-primary/10 text-primary-glow hover:bg-primary/20 disabled:opacity-60"
                    >
                      {isChallenging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Swords className="h-3 w-3" />}
                      R&W
                    </button>
                  </div>
                </li>
              );
            })}
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
