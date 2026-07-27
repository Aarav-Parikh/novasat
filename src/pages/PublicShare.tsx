import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Target, Flame, Clock, Rocket } from "lucide-react";

type PublicProgress = {
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

export default function PublicShare() {
  const { slug } = useParams();
  const [data, setData] = useState<PublicProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_public_progress", { _slug: slug! }).then(({ data }) => {
      setData(data as PublicProgress);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!data?.ok) return <div className="min-h-screen grid place-items-center text-muted-foreground">This progress link is inactive.</div>;

  const daysToTest = data.test_date
    ? Math.max(0, Math.ceil((new Date(data.test_date).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="starfield" />
      <div className="relative max-w-4xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <NovaLogo size={36} />
            <div>
              <div className="font-display font-bold">NovaSAT</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Progress share</div>
            </div>
          </div>
        </header>

        <h1 className="font-display text-4xl font-bold mb-1">
          {data.display_name}'s <span className="text-gradient-nebula">SAT prep</span>
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">
          {daysToTest !== null ? `${daysToTest} days until test day.` : "Test date not set."}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat icon={Target} label="Target" value={data.target_score ? String(data.target_score) : "—"} />
          <Stat icon={Trophy} label="Weekly XP" value={(data.weekly_xp ?? 0).toLocaleString()} />
          <Stat icon={Flame} label="Streak" value={`${data.streak ?? 0}d`} />
          <Stat icon={Clock} label="Hours" value={String(data.hours_logged ?? 0)} />
        </div>

        <div className="glass rounded-2xl p-6 mb-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Accuracy (last 7 days)</div>
          <div className="mt-2 font-display text-4xl font-bold">{data.accuracy ?? 0}%</div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Top weak topics</div>
          {(data.top_weak_topics ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.top_weak_topics!.map((t) => (
                <li key={t.topic} className="flex items-center justify-between p-2 rounded-lg bg-background/40">
                  <span className="text-sm">{t.topic}</span>
                  <span className="text-xs text-muted-foreground">{t.misses} misses</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="mt-10 text-xs text-muted-foreground text-center">
          Powered by NovaSAT · This is a read-only view shared by the student.
        </footer>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-secondary" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
