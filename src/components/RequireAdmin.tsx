import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="starfield" />
        <div className="text-muted-foreground text-sm font-mono relative z-10">Verifying access…</div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
