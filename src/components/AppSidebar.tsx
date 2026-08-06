import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Target,
  BarChart3,
  UserCircle,
  ShoppingBag,
  ShieldCheck,
  MessageSquareQuote,
  PawPrint,
  LogOut,
  Trophy,
  Users,
  Sparkles,
  History,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { NovaLogo } from "@/components/NovaLogo";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/practice", label: "Practice & Plan", icon: Target },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/projection", label: "Score Projection", icon: LineChart },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/quests", label: "Quests", icon: Sparkles },
  { to: "/pet", label: "Pet", icon: PawPrint },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/updates", label: "Update Log", icon: History },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

const adminItems = [
  { to: "/admin/users", label: "Users", icon: ShieldCheck },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("nova-sidebar-collapsed") === "1");

  useEffect(() => {
    localStorage.setItem("nova-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside className={`${collapsed ? "w-[4.5rem]" : "w-64"} hidden md:flex shrink-0 flex-col bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border relative z-20 sticky top-0 h-screen self-start transition-[width] duration-300`}>
      <div className={`${collapsed ? "px-3" : "px-5"} pt-5 pb-5 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <NovaLogo size={36} glow />
          {!collapsed && <div>
            <div className="font-display font-bold text-lg leading-none tracking-tight">NovaSAT</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
              Adaptive · SAT
            </div>
          </div>}
        </div>
        {!collapsed && <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar" className="h-8 w-8 shrink-0"><PanelLeftClose /></Button>}
      </div>

      {collapsed && <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar" className="mx-auto mb-3 h-9 w-9"><PanelLeftOpen /></Button>}

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/app"}
            className={({ isActive }) =>
              [
                `group flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-lg text-sm transition-all`,
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
                {!collapsed && <span className="font-medium">{it.label}</span>}
                {!collapsed && isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            {!collapsed && <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-[0.2em] text-warning/80">
              Admin
            </div>}
            {adminItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  [
                      `group flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-lg text-sm transition-all`,
                    isActive
                      ? "bg-warning/15 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--warning)/0.4)]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  ].join(" ")
                }
              >
                <it.icon className="h-4 w-4 text-warning" />
                {!collapsed && <span className="font-medium">{it.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4">
        <Button
          variant="outline"
          onClick={signOut}
          title="Sign out"
          className={`${collapsed ? "w-10 px-0" : "w-full"} text-xs text-muted-foreground`}
        >
          <LogOut className="h-3.5 w-3.5" /> {!collapsed && "Sign out"}
        </Button>
      </div>
    </aside>
  );
}
