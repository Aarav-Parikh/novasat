import { useState } from "react";
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
  Rocket,
  History,
  ShieldCheck,
  MessageSquareQuote,
  PawPrint,
  Menu,
  X,
  LogOut,
  Trophy,
  Users,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/plan", label: "Daily Plan", icon: CalendarDays },
  { to: "/weak-areas", label: "Weak Areas", icon: TrendingDown },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/quests", label: "Quests", icon: Sparkles },
  { to: "/pet", label: "Pet", icon: PawPrint },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/updates", label: "What's New", icon: History },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

const adminItems = [
  { to: "/admin/users", label: "Users", icon: ShieldCheck },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { signOut } = useAuth();

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 bg-background/70 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold tracking-tight">NovaSAT</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-background/90 backdrop-blur-xl animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-72 bg-sidebar border-l border-sidebar-border p-6 flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 space-y-1">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === "/app"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    ].join(" ")
                  }
                >
                  <it.icon className="h-4 w-4" />
                  <span className="font-medium">{it.label}</span>
                </NavLink>
              ))}

              {isAdmin && (
                <>
                  <div className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-[0.2em] text-warning/80">
                    Admin
                  </div>
                  {adminItems.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-warning/15 text-foreground"
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
            <div className="mt-auto pt-6">
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
