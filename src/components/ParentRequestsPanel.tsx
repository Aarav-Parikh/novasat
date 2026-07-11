import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, X, ShieldQuestion } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Link = {
  id: string;
  parent_id: string;
  student_id: string;
  status: "pending" | "accepted";
  parent_name: string | null;
};

export function ParentRequestsPanel() {
  const { user } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);

  const load = async () => {
    const { data } = await supabase.rpc("list_parent_links");
    setLinks(((data as Link[]) ?? []).filter((l) => l.student_id === user?.id));
  };
  useEffect(() => { load(); }, [user?.id]);

  const respond = async (id: string, accept: boolean) => {
    await supabase.rpc("respond_parent_link", { _id: id, _accept: accept });
    toast({ title: accept ? "Parent linked" : "Request declined" });
    load();
  };

  const pending = links.filter((l) => l.status === "pending");
  const accepted = links.filter((l) => l.status === "accepted");

  if (pending.length === 0 && accepted.length === 0) return null;

  return (
    <GlassCard>
      <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
        <ShieldQuestion className="h-5 w-5" /> Parent access
      </h2>
      <p className="text-sm text-muted-foreground mt-1">Parents who accept can view your progress (read-only). You can decline or unlink anytime.</p>

      {pending.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Requests</div>
          <ul className="space-y-2">
            {pending.map((l) => (
              <li key={l.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/40 border border-border">
                <div className="flex-1 text-sm">{l.parent_name || "A parent"} wants view access.</div>
                <button onClick={() => respond(l.id, true)} className="p-2 rounded-md bg-success/20 text-success"><Check className="h-4 w-4" /></button>
                <button onClick={() => respond(l.id, false)} className="p-2 rounded-md bg-destructive/20 text-destructive"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {accepted.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Linked parents</div>
          <ul className="space-y-2">
            {accepted.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-background/40 border border-border">
                <span className="text-sm">{l.parent_name || "Parent"}</span>
                <button onClick={() => respond(l.id, false)} className="text-xs px-2 py-1 rounded-md bg-destructive/15 text-destructive">Unlink</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
