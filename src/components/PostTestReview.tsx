import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Sparkles, ChartBar, BookOpen, Loader as Loader2, RefreshCw, KeyRound, CircleCheck as CheckCircle2, Circle as XCircle, Lightbulb } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

export interface AnswerKeyRow {
  id: string;
  index: number;
  section: string;
  topic: string;
  difficulty: string;
  prompt: string;
  userText: string;
  correctText: string;
  explanation?: string;
  ok: boolean;
}

interface Flashcard {
  front: string;
  concept?: string;
  full_explanation?: string;
  worked_example?: string;
  common_pitfalls?: string;
  memory_hook?: string;
  // legacy back field
  back?: string;
}

interface AnswerInsight {
  question_id: string;
  why_correct?: string;
  why_user_wrong?: string;
  distractor_traps?: string;
  fix_it_tip?: string;
  underlying_pattern?: string;
  shortcut?: string;
}

interface ReviewData {
  flashcards: Flashcard[];
  category_summary: { category: string; count: number; note: string }[];
  concept_breakdowns: { topic: string; what_to_study: string; drills: string[] }[];
  answer_insights: AnswerInsight[];
}

interface Props {
  missed: MissedQuestion[];
  answerKey?: AnswerKeyRow[];
}

export function PostTestReview({ missed, answerKey = [] }: Props) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [studyLoading, setStudyLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const loading = insightsLoading || studyLoading;

  const merge = (patch: Partial<ReviewData>) =>
    setData((prev) => ({
      flashcards: patch.flashcards ?? prev?.flashcards ?? [],
      category_summary: patch.category_summary ?? prev?.category_summary ?? [],
      concept_breakdowns: patch.concept_breakdowns ?? prev?.concept_breakdowns ?? [],
      answer_insights: patch.answer_insights ?? prev?.answer_insights ?? [],
    }));

  // Two smaller parallel generations finish much faster than one giant one,
  // and each half renders the moment it lands.
  const fetchReview = async () => {
    if (missed.length === 0) return;
    setError(null);
    setData(null);
    setInsightsLoading(true);
    setStudyLoading(true);

    const run = async (part: "insights" | "study") => {
      const { data: res, error: err } = await supabase.functions.invoke("post-test-review", {
        body: { missed, part },
      });
      if (err) throw err;
      merge(res as Partial<ReviewData>);
    };

    const [a, b] = await Promise.allSettled([run("insights"), run("study")]);
    setInsightsLoading(false);
    setStudyLoading(false);
    if (a.status === "rejected" && b.status === "rejected") {
      setError((a.reason as any)?.message ?? "Failed to load review");
    }
  };

  useEffect(() => { fetchReview(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insightsLoading && studyLoading]);


  const insightsById = useMemo(() => {
    const map = new Map<string, AnswerInsight>();
    (data?.answer_insights ?? []).forEach((ins) => map.set(ins.question_id, ins));
    return map;
  }, [data]);

  const mathKey = answerKey.filter((r) => r.section === "Math");
  const elaKey = answerKey.filter((r) => r.section === "Reading & Writing");

  const renderAnswerRow = (r: AnswerKeyRow) => {
    const ins = insightsById.get(r.id);
    return (
      <div key={r.id} className={`glass p-4 border ${r.ok ? "border-success/30" : "border-destructive/30"}`}>
        <div className="flex items-start gap-3">
          {r.ok ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Q{r.index + 1} · {r.topic} · <span className="capitalize">{r.difficulty}</span></div>
            <div className="text-sm mt-1 font-medium whitespace-pre-wrap">{r.prompt}</div>
            <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs">
              <div className={`rounded border px-2 py-1.5 ${r.ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                <span className="text-muted-foreground">Your answer: </span>{r.userText}
              </div>
              <div className="rounded border border-success/30 bg-success/5 px-2 py-1.5">
                <span className="text-muted-foreground">Correct: </span>{r.correctText}
              </div>
            </div>
            {r.explanation && <p className="mt-2 text-xs text-muted-foreground">{r.explanation}</p>}

            {/* Richer AI insight for wrong answers */}
            {!r.ok && ins && (
              <div className="mt-3 space-y-2 rounded-lg border border-secondary/30 bg-secondary/5 p-3">
                {ins.why_correct && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-success">Why the correct answer is right</div>
                    <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{ins.why_correct}</div>
                  </div>
                )}
                {ins.why_user_wrong && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-destructive">Why your answer missed</div>
                    <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{ins.why_user_wrong}</div>
                  </div>
                )}
                {ins.distractor_traps && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-warning">Trap breakdown</div>
                    <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{ins.distractor_traps}</div>
                  </div>
                )}
                {ins.underlying_pattern && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-primary">The underlying pattern</div>
                    <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{ins.underlying_pattern}</div>
                  </div>
                )}
                {ins.shortcut && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-secondary">Shortcut / trick</div>
                    <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{ins.shortcut}</div>
                  </div>
                )}
                {ins.fix_it_tip && (
                  <div className="flex items-start gap-2 pt-1 border-t border-border/60">
                    <Lightbulb className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground/90 leading-relaxed"><span className="font-semibold">Next time:</span> {ins.fix_it_tip}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentCard = data?.flashcards?.[cardIdx];

  return (
    <div className="mt-8 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-semibold flex items-center gap-2"><Brain className="h-5 w-5 text-secondary" /> Post-Test Review Dashboard</h3>
        {data && !loading && (
          <button onClick={fetchReview} className="text-xs inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
        )}
      </div>

      <Tabs defaultValue="answer-key" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="answer-key" className="gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Answer Key</TabsTrigger>
          <TabsTrigger value="flashcards" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Flashcards</TabsTrigger>
          <TabsTrigger value="concepts" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Concept Breakdowns</TabsTrigger>
          <TabsTrigger value="errors" className="gap-1.5"><ChartBar className="h-3.5 w-3.5" /> Error Categorization</TabsTrigger>
        </TabsList>

        {/* Answer Key */}
        <TabsContent value="answer-key" className="mt-4">
          {answerKey.length === 0 ? (
            <div className="glass p-5 text-sm text-muted-foreground">No questions to display.</div>
          ) : (
            <Tabs defaultValue={mathKey.length >= elaKey.length ? "math" : "ela"}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="math">Math ({mathKey.length})</TabsTrigger>
                <TabsTrigger value="ela">ELA ({elaKey.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="math" className="mt-4 space-y-3">
                {mathKey.length === 0 ? <div className="text-sm text-muted-foreground">No math questions.</div> : mathKey.map(renderAnswerRow)}
              </TabsContent>
              <TabsContent value="ela" className="mt-4 space-y-3">
                {elaKey.length === 0 ? <div className="text-sm text-muted-foreground">No ELA questions.</div> : elaKey.map(renderAnswerRow)}
              </TabsContent>
            </Tabs>
          )}
          {insightsLoading && (
            <div className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading detailed AI breakdown for each wrong answer…
            </div>
          )}
        </TabsContent>

        {/* Flashcards */}
        <TabsContent value="flashcards" className="mt-4">
          {missed.length === 0 ? (
            <div className="glass p-6 text-center">
              <Sparkles className="h-6 w-6 text-success mx-auto" />
              <div className="font-display text-lg font-semibold mt-2">Perfect run — no flashcards needed.</div>
            </div>
          ) : studyLoading ? (
            <div className="glass p-6 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-secondary" /> Generating flashcards…
            </div>
          ) : error ? (
            <div className="glass p-5 border border-destructive/40 text-sm text-destructive">{error}</div>
          ) : data && data.flashcards.length > 0 && currentCard ? (
            <div className="glass p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-muted-foreground">Tap card to flip</div>
                <span className="text-xs font-mono text-muted-foreground">{cardIdx + 1} / {data.flashcards.length}</span>
              </div>
              <div
                onClick={() => setFlipped((f) => !f)}
                className="w-full min-h-[320px] cursor-pointer select-none"
                style={{ perspective: "1200px" }}
              >
                <div
                  className="relative w-full min-h-[320px] transition-transform duration-500"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 rounded-xl border border-border bg-muted/20 p-6 flex flex-col justify-center"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-secondary mb-3">Front · concept prompt</div>
                    <div className="text-base leading-relaxed font-medium">{currentCard.front}</div>
                    <div className="mt-6 text-[10px] uppercase tracking-widest text-muted-foreground">Tap to reveal the full breakdown →</div>
                  </div>
                  {/* Back */}
                  <div
                    className="absolute inset-0 rounded-xl border border-secondary/40 bg-secondary/5 p-5 overflow-y-auto"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-secondary mb-2">Back · deep dive</div>
                    {currentCard.concept && (
                      <div className="mb-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Concept</div>
                        <div className="text-sm font-semibold leading-snug">{currentCard.concept}</div>
                      </div>
                    )}
                    {currentCard.full_explanation && (
                      <div className="mb-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Explanation</div>
                        <div className="text-xs leading-relaxed">{currentCard.full_explanation}</div>
                      </div>
                    )}
                    {currentCard.worked_example && (
                      <div className="mb-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Worked example</div>
                        <div className="text-xs leading-relaxed font-mono bg-background/40 rounded px-2 py-1.5 border border-border/60">{currentCard.worked_example}</div>
                      </div>
                    )}
                    {currentCard.common_pitfalls && (
                      <div className="mb-3">
                        <div className="text-[10px] uppercase tracking-widest text-destructive">Common pitfalls</div>
                        <div className="text-xs leading-relaxed">{currentCard.common_pitfalls}</div>
                      </div>
                    )}
                    {currentCard.memory_hook && (
                      <div className="flex items-start gap-2 mt-3 pt-2 border-t border-border/60">
                        <Lightbulb className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                        <div className="text-xs italic">{currentCard.memory_hook}</div>
                      </div>
                    )}
                    {/* Legacy fallback */}
                    {!currentCard.full_explanation && currentCard.back && (
                      <div className="text-sm leading-relaxed">{currentCard.back}</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <button
                  disabled={cardIdx === 0}
                  onClick={() => { setCardIdx((i) => i - 1); setFlipped(false); }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs disabled:opacity-40"
                >Prev</button>
                <button
                  disabled={cardIdx >= data.flashcards.length - 1}
                  onClick={() => { setCardIdx((i) => i + 1); setFlipped(false); }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs disabled:opacity-40"
                >Next</button>
              </div>
            </div>
          ) : (
            <div className="glass p-5 text-sm text-muted-foreground">No flashcards available.</div>
          )}
        </TabsContent>

        {/* Concept breakdowns */}
        <TabsContent value="concepts" className="mt-4">
          {missed.length === 0 ? (
            <div className="glass p-6 text-center text-sm text-muted-foreground">Nothing to break down — perfect run!</div>
          ) : studyLoading ? (
            <div className="glass p-6 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-secondary" /> Generating concept breakdowns…
            </div>
          ) : error ? (
            <div className="glass p-5 border border-destructive/40 text-sm text-destructive">{error}</div>
          ) : data && data.concept_breakdowns.length > 0 ? (
            <div className="glass p-5 space-y-4">
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
          ) : (
            <div className="glass p-5 text-sm text-muted-foreground">No breakdowns available.</div>
          )}
        </TabsContent>

        {/* Error categorization */}
        <TabsContent value="errors" className="mt-4">
          {missed.length === 0 ? (
            <div className="glass p-6 text-center text-sm text-muted-foreground">No errors to categorize.</div>
          ) : studyLoading ? (
            <div className="glass p-6 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-secondary" /> Analyzing error patterns…
            </div>
          ) : error ? (
            <div className="glass p-5 border border-destructive/40 text-sm text-destructive">{error}</div>
          ) : data && data.category_summary.length > 0 ? (
            <div className="glass p-5 space-y-2">
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
          ) : (
            <div className="glass p-5 text-sm text-muted-foreground">No category signal detected.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
