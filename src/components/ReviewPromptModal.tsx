import { useState } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export function ReviewPromptModal({ onClose }: { onClose: (dismissed: boolean) => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || rating === 0) return;
    setBusy(true);
    const { error } = await supabase
      .from("reviews")
      .upsert(
        { user_id: user.id, rating, comment: comment.trim() || null },
        { onConflict: "user_id" },
      );
    if (error) {
      toast({ title: "Couldn't save review", description: error.message, variant: "destructive" });
      setBusy(false);
      return;
    }
    await supabase.rpc("mark_review_prompt_dismissed");
    toast({ title: "Thank you!", description: "Your feedback launched successfully." });
    onClose(true);
  };

  const dismiss = async () => {
    await supabase.rpc("mark_review_prompt_dismissed");
    onClose(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="glass glass-purple max-w-md w-full p-6 sm:p-7 relative animate-scale-in">
        <button
          onClick={() => onClose(false)}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Later"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[10px] uppercase tracking-[0.25em] text-secondary">Quick favor</div>
        <h2 className="font-display text-2xl font-bold mt-1">How is NovaSAT treating you?</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Your honest rating helps us improve faster.
        </p>

        <div className="mt-5 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                className={`h-9 w-9 transition-colors ${
                  n <= (hover || rating)
                    ? "fill-warning text-warning"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything you'd like us to know? (optional)"
          rows={3}
          className="mt-4 w-full px-3 py-2.5 rounded-lg bg-background/60 border border-border focus:border-primary/60 focus:outline-none text-sm resize-none"
        />

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Don't ask again
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onClose(false)}
              className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Maybe later
            </button>
            <button
              onClick={submit}
              disabled={rating === 0 || busy}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "…" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
