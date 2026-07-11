import { Navigate } from "react-router-dom";
import { useNova } from "@/lib/novaprep-store";

export function RequireStudent({ children }: { children: JSX.Element }) {
  const profile = useNova((s) => s.profile);
  // While loading, render children (RequireAuth already gated); once profile arrives, block parents.
  if (profile && profile.account_type === "parent") {
    return <Navigate to="/parent" replace />;
  }
  return children;
}
