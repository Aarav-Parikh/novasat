import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="starfield" />
        <div className="text-muted-foreground text-sm font-mono relative z-10">Initializing…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: loc }} replace />;
  return children;
}
