import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Sparkles, ChartBar, BookOpen, Loader as Loader2, RefreshCw } from "lucide-react";

export interface MissedQuestion {
  question_id: string;
  section?: string;
  topic?: string;
  prompt: string;
  user_answer?: string;
  correct_answer?: string;
  explanation?: string;
  flag_category?: string | null;
  eliminations?: Record<string, string>;
}

interface ReviewData {
  flashcards: { front: string; back: string }[];
  category_summary: { category: string; count: number; note: string }[];
  concept_breakdowns: { topic: string; what_to_study: string; drills: string[] }[];
}

interface Props {
  missed: MissedQuestion[];
}

export function PostTestReview({ missed }: Props) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [cardIdx, setCardIdx] = useState(0);

  const fetchReview = async () => {
    if (missed.length === 0) return;
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("post-test-review", { body: { missed } });
      if (error) throw error;
      setData(data as ReviewData);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load review");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReview(); /* eslint-disable-next-line */ }, []);

  if (missed.length === 0) {
    return (
      <div className="glass p-6 mt-6 text-center">
        <Sparkles className="h-6 w-6 text-success mx-auto" />
        <div className="font-display text-lg font-semibold mt-2">Perfect run — no missed questions to review.</div>
        <p className="text-xs text-muted-foreground mt-1">Mission Control will still log everything for your stats.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-semibold flex items-center gap-2"><Brain className="h-5 w-5 text-secondary" /> AI Review Dashboard</h3>
        {data && !loading && (
          <button onClick={fetchReview} className="text-xs inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div className="glass p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-secondary" /> Generating flashcards and concept breakdowns…
        </div>
      )}

      {error && !loading && (
        <div className="glass p-5 border border-destructive/40">
          <div className="text-sm text-destructive">{error}</div>
          <button onClick={fetchReview} className="mt-3 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs">Try again</button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Error categorization */}
          <div className="glass p-5">
            <div className="flex items-center gap-2 mb-3">
              <ChartBar className="h-4 w-4 text-secondary" />
              <h4 className="font-display text-lg font-semibold">Error Categorization</h4>
            </div>
            {data.category_summary.length === 0 ? (
              <div className="text-sm text-muted-foreground">No category signal detected.</div>
            ) : (
              <div className="space-y-2">
                {data.category_summary.map((c, i) => {
                  const max = Math.max(...data.category_summary.map((x) => x.count), 1);
                  const pct = (c.count / max) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs"><span className="font-medium">{c.category}</span><span className="font-mono text-muted-foreground">{c.count}</span></div>
                      <div className="h-2 mt-1 rounded bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${pct}%` }} /></div>
                      <div className="text-[11px] text-muted-foreground mt-1">{c.note}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Flashcards */}
          {data.flashcards.length > 0 && (
            <div className="glass p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-secondary" />
                  <h4 className="font-display text-lg font-semibold">Flashcards</h4>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{cardIdx + 1} / {data.flashcards.length}</span>
              </div>
              <button
                onClick={() => setFlipped((f) => ({ ...f, [cardIdx]: !f[cardIdx] }))}
                className="w-full min-h-[140px] rounded-xl border border-border bg-muted/20 p-5 text-left transition-colors hover:border-secondary/40"
              >
                <div className="text-[10px] uppercase tracking-widest text-secondary mb-2">{flipped[cardIdx] ? "Back · rule" : "Front · concept"}</div>
                <div className="text-sm leading-relaxed">{flipped[cardIdx] ? data.flashcards[cardIdx].back : data.flashcards[cardIdx].front}</div>
                <div className="text-[10px] text-muted-foreground mt-3">Tap to flip</div>
              </button>
              <div className="mt-3 flex justify-between">
                <button disabled={cardIdx === 0} onClick={() => { setCardIdx((i) => i - 1); setFlipped({}); }} className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs disabled:opacity-40">Prev</button>
                <button disabled={cardIdx >= data.flashcards.length - 1} onClick={() => { setCardIdx((i) => i + 1); setFlipped({}); }} className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}

          {/* Concept breakdowns */}
          {data.concept_breakdowns.length > 0 && (
            <div className="glass p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-secondary" />
                <h4 className="font-display text-lg font-semibold">Deep Concept Breakdowns</h4>
              </div>
              <div className="space-y-4">
                {data.concept_breakdowns.map((b, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-secondary">{b.topic}</div>
                    <p className="text-sm mt-1.5 leading-relaxed">{b.what_to_study}</p>
                    {b.drills?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Practice drills</div>
                        <ul className="space-y-1">
                          {b.drills.map((d, j) => (
                            <li key={j} className="text-xs text-foreground/80 pl-3 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-secondary">{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
