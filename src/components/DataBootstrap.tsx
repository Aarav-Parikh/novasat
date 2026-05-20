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

    const reload = () => loadAll(user.id);
    const channel = supabase
      .channel(`nova-sync:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "mistakes", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_completions", filter: `user_id=eq.${user.id}` }, reload)
      .subscribe();

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
