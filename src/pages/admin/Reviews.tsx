import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";

interface ReviewRow {
  id: string;
  user_id: string;
  display_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

const Stars = ({ n }: { n: number }) => (
  <div className="flex">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < n ? "fill-warning text-warning" : "text-muted-foreground/40"}`}
      />
    ))}
  </div>
);

const AdminReviews = () => {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("admin_all_reviews").then(({ data }) => {
      setReviews((data as ReviewRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const avg =
    reviews.length === 0
      ? 0
      : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-2 mb-8">
        <span className="text-xs uppercase tracking-[0.25em] text-secondary">Admin Console</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          {reviews.length} review{reviews.length === 1 ? "" : "s"} · avg{" "}
          <span className="text-warning font-semibold">{avg.toFixed(2)} ★</span>
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : reviews.length === 0 ? (
        <GlassCard className="!p-8 text-center text-muted-foreground">
          No reviews yet.
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <GlassCard key={r.id} className="!p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="font-display font-semibold">{r.display_name || "Anonymous"}</div>
                <Stars n={r.rating} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                {new Date(r.created_at).toLocaleString()}
              </div>
              {r.comment && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  "{r.comment}"
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default AdminReviews;
