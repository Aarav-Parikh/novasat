import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Trophy, Flame, Clock, Target, CalendarDays } from "lucide-react";

type Link = {
  id: string;
  parent_id: string;
  student_id: string;
  status: "pending" | "accepted";
  parent_name: string | null;
  student_name: string | null;
  student_email: string | null;
};

type Progress = {
  ok: boolean;
  reason?: string;
  display_name?: string;
  target_score?: number | null;
  test_date?: string | null;
  xp?: number;
  streak?: number;
  weekly_xp?: number;
  hours_logged?: number;
  accuracy?: number;
  top_weak_topics?: { topic: string; misses: number }[];
};

export default function ParentHome() {
  const [links, setLinks] = useState<Link[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const loadLinks = async () => {
    const { data } = await supabase.rpc("list_parent_links");
    const rows = (data as Link[]) ?? [];
    setLinks(rows);
    const accepted = rows.filter((l) => l.status === "accepted");
    if (!selected && accepted.length > 0) setSelected(accepted[0].student_id);
  };
  useEffect(() => { loadLinks(); }, []);

  useEffect(() => {
    if (!selected) { setProgress(null); return; }
    (async () => {
      const { data } = await supabase.rpc("parent_child_progress", { _student_id: selected });
      setProgress(data as unknown as Progress);
    })();
  }, [selected]);

  const request = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("request_parent_link", { _child_email: email.trim() });
    setBusy(false);
    const res = data as { ok: boolean; reason?: string } | null;
    if (error || !res?.ok) {
      toast({ title: "Couldn't send request", description: res?.reason ?? error?.message });
      return;
    }
    toast({ title: "Request sent", description: "Your child needs to accept from their Profile." });
    setEmail("");
    loadLinks();
  };

  const accepted = links.filter((l) => l.status === "accepted");
  const pending = links.filter((l) => l.status === "pending");

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Parent Dashboard</span>
        <h1 className="font-display text-4xl font-bold">Overseeing progress</h1>
        <p className="text-muted-foreground mt-2">View-only access to your linked student's SAT prep progress. You can't run drills or edit their data.</p>
      </div>

      <GlassCard className="mb-6">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Link a student</h3>
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Student's email address"
            className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <button onClick={request} disabled={busy}
            className="rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Send request
          </button>
        </div>
        {pending.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            Pending: {pending.map((l) => l.student_email || l.student_name || "Student").join(", ")}
          </div>
        )}
      </GlassCard>

      {accepted.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted-foreground">No linked students yet. Ask your child to accept the request from their Profile page.</p>
        </GlassCard>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {accepted.map((l) => (
              <button key={l.id} onClick={() => setSelected(l.student_id)}
                className={`px-4 py-2 rounded-lg text-sm ${selected === l.student_id ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground" : "bg-muted/40 text-muted-foreground"}`}>
                {l.student_name || l.student_email || "Student"}
              </button>
            ))}
          </div>

          {progress?.ok && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Stat icon={Flame} label="Streak" value={`${progress.streak ?? 0}d`} />
                <Stat icon={Trophy} label="Weekly XP" value={(progress.weekly_xp ?? 0).toLocaleString()} />
                <Stat icon={Clock} label="Hours logged" value={`${progress.hours_logged ?? 0}h`} />
                <Stat icon={Target} label="Accuracy" value={`${progress.accuracy ?? 0}%`} />
              </div>

              <GlassCard variant="purple" className="mb-6">
                <h3 className="font-display text-xl font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Test snapshot
                </h3>
                <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Target score:</span> <span className="font-semibold">{progress.target_score ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Test date:</span> <span className="font-semibold">{progress.test_date ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Total XP:</span> <span className="font-semibold">{(progress.xp ?? 0).toLocaleString()}</span></div>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="font-display text-xl font-semibold mb-3">Top weak topics</h3>
                {(progress.top_weak_topics ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mistakes logged yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {(progress.top_weak_topics ?? []).map((t, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-background/40 border border-border px-3 py-2 text-sm">
                        <span>{t.topic}</span>
                        <span className="font-mono text-muted-foreground">{t.misses} miss{t.misses > 1 ? "es" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </>
          )}
        </>
      )}
    </AppLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <GlassCard className="!p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-secondary" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
    </GlassCard>
  );
}
