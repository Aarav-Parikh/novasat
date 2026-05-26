import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  CalendarDays,
  Sparkles,
  TrendingDown,
  BarChart3,
  UserCircle,
  ShoppingBag,
  BookOpen,
  Rocket,
  HelpCircle,
  ShieldCheck,
  MessageSquareQuote,
  PawPrint,
  LogOut,
} from "lucide-react";
import { useNova } from "@/lib/novaprep-store";
import { rankFromXP } from "@/lib/novaprep-data";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/plan", label: "Daily Plan", icon: CalendarDays },
  { to: "/articles", label: "Articles", icon: BookOpen },
  { to: "/weak-areas", label: "Weak Areas", icon: TrendingDown },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/pet", label: "Pet", icon: PawPrint },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/help", label: "Help", icon: HelpCircle },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

const adminItems = [
  { to: "/admin/users", label: "Users", icon: ShieldCheck },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote },
];

export function AppSidebar() {
  const profile = useNova((s) => s.profile);
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const xp = profile?.xp ?? 0;
  const info = rankFromXP(xp);
  const pct =
    info.ceiling === info.floor
      ? 100
      : Math.min(100, ((xp - info.floor) / (info.ceiling - info.floor)) * 100);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border relative z-10 sticky top-0 h-screen self-start">
      <div className="px-6 pt-6 pb-8">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[var(--glow-purple)]">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none tracking-tight">NovaSAT</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
              Adaptive · SAT
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <it.icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-secondary"
                  }`}
                />
                <span className="font-medium">{it.label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-[0.2em] text-warning/80">
              Admin
            </div>
            {adminItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                    isActive
                      ? "bg-warning/15 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--warning)/0.4)]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  ].join(" ")
                }
              >
                <it.icon className="h-4 w-4 text-warning" />
                <span className="font-medium">{it.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4">
        <div className="glass glass-purple p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>Rank</span>
            <span className="font-mono text-secondary">{xp.toLocaleString()} XP</span>
          </div>
          <div className="mt-2 font-display font-semibold text-lg text-gradient-nebula">
            {info.rank}
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Next: <span className="text-foreground/80">{info.next}</span>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
