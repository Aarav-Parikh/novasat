import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Users as UsersIcon, Zap, Activity, Star, Clock3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GlobalStats {
  total_users: number;
  total_focus_minutes: number;
  total_xp: number;
  total_sessions: number;
  total_session_seconds: number;
  total_reviews: number;
  avg_rating: number;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  xp: number;
  streak: number;
  focus_minutes_total: number;
  sessions_count: number;
  session_minutes: number;
  login_count: number;
  last_login_at: string | null;
  created_at: string;
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

const AdminUsers = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [{ data: g, error: globalError }, { data: u, error: usersError }] = await Promise.all([
      supabase.rpc("admin_global_stats"),
      supabase.rpc("admin_user_summary"),
    ]);
    if (globalError || usersError) console.error("Admin activity sync failed", globalError ?? usersError);
    setStats((g as any)?.[0] ?? null);
    setUsers((u as UserRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // Live-sync: reload whenever anyone finishes a session or profile changes
    const channel = supabase
      .channel("admin-users-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col gap-2 mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Admin Console</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold">Users</h1>
        <p className="text-muted-foreground">Live-synced platform stats and per-user activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={UsersIcon} label="Sign-ups" value={stats?.total_users ?? 0} />
        <StatCard icon={Zap} label="Total XP" value={(stats?.total_xp ?? 0).toLocaleString()} />
        <StatCard icon={Activity} label="Sessions" value={stats?.total_sessions ?? 0} />
        <StatCard
          icon={Star}
          label="Avg rating"
          value={stats?.total_reviews ? `${Number(stats.avg_rating).toFixed(2)} ★` : "—"}
        />
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display text-xl font-semibold">All users ({users.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>XP</TableHead>
                <TableHead>Streak</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="whitespace-nowrap"><Clock3 className="inline h-3 w-3 mr-1" />Min</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.display_name || u.email} url={u.avatar_url} size={28} />
                      <span className="truncate max-w-[10rem]">{u.display_name || u.email?.split("@")[0] || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>{u.xp.toLocaleString()}</TableCell>
                  <TableCell>{u.streak}</TableCell>
                  <TableCell>{Number(u.sessions_count ?? 0)}</TableCell>
                  <TableCell>{Number(u.session_minutes ?? 0)}</TableCell>
                  <TableCell>{u.login_count}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(u.last_login_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </AppLayout>
  );
};

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <GlassCard className="!p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </GlassCard>
  );
}

export default AdminUsers;
