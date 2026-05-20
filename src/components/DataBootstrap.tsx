import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNova } from "@/lib/novaprep-store";
import { supabase } from "@/integrations/supabase/client";

export function DataBootstrap() {
  const { user } = useAuth();
  const loadAll = useNova((s) => s.loadAll);
  const reset = useNova((s) => s.reset);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    loadAll(user.id);

    // Realtime subscription: any change to this user's data on the server
    // (from another tab, edge function, or direct DB write) triggers a
    // full reload so dashboard, analytics, profile, etc. stay in sync.
    const reload = () => loadAll(user.id);
    const channel = supabase
      .channel(`nova-sync:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "mistakes", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_completions", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "mystery_boxes", filter: `user_id=eq.${user.id}` }, reload)
      .subscribe();

    // Refresh whenever this tab regains focus or becomes visible again.
    const onFocus = () => loadAll(user.id);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadAll(user.id);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, loadAll, reset]);

  return null;
}
