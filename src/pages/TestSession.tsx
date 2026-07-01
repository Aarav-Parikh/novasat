import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Clock, Flag, X, ChevronRight, Rocket, Loader as Loader2, TriangleAlert as AlertTriangle, Coffee, CircleCheck as CheckCircle2, Circle as XCircle } from "lucide-react";
import { Question, ErrorReason, xpForDifficulty } from "@/lib/novaprep-data";
import { useNova } from "@/lib/novaprep-store";
import { generateQuestions } from "@/lib/generate-questions";
import { sanitizeMath } from "@/lib/sanitize-math";
import { toast } from "@/hooks/use-toast";
import { taskCompletionKey } from "@/lib/practice-links";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FlagCategoryPicker, FlagCategory } from "@/components/FlagCategoryPicker";
import { ChoiceEliminator } from "@/components/ChoiceEliminator";
import { PostTestReview, MissedQuestion } from "@/components/PostTestReview";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Mode = "full" | "shortfull" | "reading" | "math" | "redemption" | "review";
type AnswerValue = number | string;

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const MODULE_SIZE: Record<Mode, number> = { full: 54, shortfull: 20, reading: 12, math: 12, redemption: 12, review: 10 };
const MODULE_LIMIT: Record<Mode, number> = { full: 64 * 60, shortfull: 22 * 60, reading: 16 * 60, math: 20 * 60, redemption: 18 * 60, review: 15 * 60 };
const BREAK_KEY = "novaprep:sat-break-endsAt";
const BREAK_SECONDS = 10 * 60;

const textLines = (text: string) => sanitizeMath(text).split("\n");
const renderText = (text: string) => textLines(text).map((line, i, arr) => <span key={i}>{line}{i < arr.length - 1 && <br />}</span>);
const normalizeSPR = (value: AnswerValue | undefined) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

// Shuffle choices in-place: returns a new question with permuted choices and remapped correct index.
const shuffleChoices = (q: Question): Question => {
  if (q.responseType === "spr") return q;
  const order = q.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const newChoices = order.map((i) => q.choices[i]);
  const newCorrect = order.indexOf(q.correct);
  return { ...q, choices: newChoices, correct: newCorrect };
};

const isSkipped = (answer: AnswerValue | undefined) => answer === "__skipped__";
const isCorrectAnswer = (q: Question, answer: AnswerValue | undefined) => {
  if (answer === undefined || isSkipped(answer)) return false;
  if (q.responseType === "spr") return normalizeSPR(answer) === normalizeSPR(q.correctText ?? q.choices[q.correct]);
  return answer === q.correct;
};
const answerIndex = (answer: AnswerValue | undefined) => typeof answer === "number" ? answer : null;

const TestSession = () => {
  const { mode = "full" } = useParams();
  const m = mode as Mode;
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const recordMistake = useNova((s) => s.recordMistake);
  const recordSession = useNova((s) => s.recordSession);
  const resolveMistake = useNova((s) => s.resolveMistake);
  const markTaskComplete = useNova((s) => s.markTaskComplete);
  const syncProfile = useNova((s) => s.syncProfile);
  const mistakes = useNova((s) => s.mistakes);
  const requestedTopic = searchParams.get("topic") ?? undefined;
  const taskLabel = searchParams.get("task") ?? undefined;
  const dayLabel = searchParams.get("day") ?? undefined;
  const weakTopic = requestedTopic ?? mistakes[0]?.topic;

  const [module, setModule] = useState<1 | 2>(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [flagDetails, setFlagDetails] = useState<Record<string, { category: FlagCategory; note?: string }>>({});
  const [eliminations, setEliminations] = useState<Record<string, Record<number, string>>>({});
  const [flagPickerOpen, setFlagPickerOpen] = useState(false);
  const [elimPicker, setElimPicker] = useState<{ qid: string; choice: number } | null>(null);
  const [postReviewMissed, setPostReviewMissed] = useState<MissedQuestion[] | null>(null);
  const profile = useNova((s) => s.profile);
  const adaptivePacingOn = profile?.adaptive_pacing_enabled !== false;
  const showPacingCues = (m === "full" || m === "shortfull") && adaptivePacingOn && (profile?.full_sat_pacing_uses ?? 0) < 3;
  const [m1FlagDetails, setM1FlagDetails] = useState<Record<string, { category: FlagCategory; note?: string }>>({});
  const [m1Eliminations, setM1Eliminations] = useState<Record<string, Record<number, string>>>({});
  const [sessionTime, setSessionTime] = useState(0);
  const sessionTimeRef = useRef(0);
  const timerDisplayRef = useRef<HTMLSpanElement>(null);
  const [qStart, setQStart] = useState<number>(Date.now());
  const [timeByQuestion, setTimeByQuestion] = useState<Record<string, number>>({});
  const [reviewing, setReviewing] = useState(false);
  const [done, setDone] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [completed, setCompleted] = useState({ correct: 0, total: 0, seconds: 0, xp: 0 });
  const [exitOpen, setExitOpen] = useState(false);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  const [breakTick, setBreakTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [treatsEarned, setTreatsEarned] = useState(0);
  const [answerKey, setAnswerKey] = useState<{ questions: Question[]; answers: Record<string, AnswerValue> } | null>(null);
  const [moduleOneSnapshot, setModuleOneSnapshot] = useState<{ questions: Question[]; answers: Record<string, AnswerValue> } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isFullLike = m === "full" || m === "shortfull";
  const fullLimits = m === "shortfull" ? { m1: 22 * 60, m2: 28 * 60 } : { m1: 64 * 60, m2: 70 * 60 };
  const fullCounts = m === "shortfull" ? { m1: 20, m2: 16 } : { m1: 54, m2: 44 };
  const currentLimit = isFullLike ? (module === 1 ? fullLimits.m1 : fullLimits.m2) : MODULE_LIMIT[m];
  const exerciseName =
    m === "full" ? "Full SAT Simulation" :
    m === "shortfull" ? "Short SAT Simulation" :
    m === "reading" ? "Reading & Writing drill" :
    m === "math" ? "Math drill" :
    m === "redemption" ? "Weak-area redemption drill" :
    "Mistake review";


  const cleanExplanation = (text: string) =>
    text
      .replace(/<tool_call>[\s\S]*?<\/think>/gi, "")
      .replace(/(^|\n)\s*(reasoning|chain of thought|internal thinking)\s*:[\s\S]*/gi, "")
      .replace(/\\n/g, "\n")
      .trim();

  // Strip inline "(A) ..." style choices that the generator sometimes appends to the prompt.
  // The four choices are shown separately below the prompt, so leaving them inline is redundant and confusing.
  const stripInlineChoices = (prompt: string) => {
    let out = prompt;
    // Remove trailing "A) ... B) ... C) ... D) ..." (with or without parentheses, various dashes)
    out = out.replace(/\s*(?:^|[\s\n])\(?\s*[A-D][\)\.\:]\s+.+?(?=(?:[\s\n]\(?\s*[A-D][\)\.\:]\s)|$)/gs, (m) =>
      /^\s*\(?[A-D][\)\.\:]/.test(m) ? "" : m,
    );
    // Extra safety: remove any "A) foo  B) bar  C) baz  D) qux" block at the very end
    out = out.replace(/(?:\s*\(?[A-D][\)\.\:]\s+[^\n]+){3,4}\s*$/g, "");
    return out.trim();
  };

  const stampTime = () => {
    const elapsed = Math.round((Date.now() - qStart) / 1000);
    const current = questions[idx];
    if (current) setTimeByQuestion((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + elapsed }));
  };

  const prepareQuestions = (qs: Question[]): Question[] => qs.map((question): Question => shuffleChoices({
    ...question,
    responseType: question.section === "Math" && question.responseType === "spr" ? "spr" : "multiple-choice",
    correct: Number.isInteger(question.correct) && question.correct >= 0 && question.correct <= 3 ? question.correct : 0,
    correctText: question.responseType === "spr" ? question.correctText : question.choices[question.correct] ?? question.correctText,
    prompt: question.responseType === "spr" ? question.prompt : stripInlineChoices(question.prompt),
    explanation: cleanExplanation(question.explanation),
  })).filter((question) => question.responseType === "spr" || Boolean(question.choices[question.correct]));

  const loadQuestions = async (bias: "balanced" | "easier" | "harder", targetModule = module) => {
    setLoading(true);
    try {
      if (m === "review" && mistakes.length > 0) {
        const reviewSource = requestedTopic
          ? mistakes.filter((mi) => mi.topic.toLowerCase() === requestedTopic.toLowerCase())
          : mistakes;
        setQuestions(prepareQuestions((reviewSource.length ? reviewSource : mistakes).slice(0, MODULE_SIZE.review).map((mi, i): Question => ({
          id: `redo:${mi.id}:${i}`,
          section: mi.section as any,
          topic: mi.topic,
          difficulty: mi.difficulty,
          prompt: mi.prompt,
          passage: mi.passage ?? undefined,
          choices: mi.choices,
          correct: mi.correct_index,
          responseType: "multiple-choice",
          correctText: mi.choices[mi.correct_index],
          explanation: cleanExplanation(mi.explanation ?? ""),
        }))));
      } else {
        const fullSection = targetModule === 1 ? "Reading & Writing" : "Math";
        const modeSection = m === "math" ? "Math" : m === "reading" ? "Reading & Writing" : undefined;
        const requestedSection = isFullLike ? fullSection : modeSection;
        const modeTopic = requestedTopic && requestedTopic !== "Mixed SAT Skills" ? requestedTopic : undefined;
        const targetCount = isFullLike ? (targetModule === 1 ? fullCounts.m1 : fullCounts.m2) : MODULE_SIZE[m];
        // Request extra questions so the post-filter pool is large enough
        const requestCount = Math.ceil(targetCount * 1.4);
        const generatorMode = m === "review" ? "redemption" : m === "shortfull" ? "full" : m;
        const fetchBatch = () => generateQuestions({
          mode: generatorMode,
          count: requestCount,
          difficultyBias: bias,
          topic: m === "redemption" ? weakTopic : modeTopic,
          section: requestedSection ?? undefined,
        });
        let pool: Question[] = await fetchBatch();
        let filtered = requestedSection ? pool.filter((q) => q.section === requestedSection) : pool;
        // Retry once if the AI returned too few items of the requested subject
        if (requestedSection && filtered.length < targetCount) {
          try {
            const more = await fetchBatch();
            filtered = [...filtered, ...more.filter((q) => q.section === requestedSection)];
          } catch {}
        }
        setQuestions(prepareQuestions(filtered.slice(0, targetCount)));
      }
    } catch (e: any) {
      const msg = e?.message ?? "Please try again";
      const isRateLimit = /rate limit/i.test(msg);
      toast({
        title: isRateLimit ? "AI is busy — try again in a few seconds" : "Question generation failed",
        description: isRateLimit
          ? "The question generator hit a temporary rate limit. Wait a moment and tap retry."
          : msg,
        variant: "destructive",
      });
      // Stay on the page with an empty question set so the user can retry
      setQuestions([]);
    } finally {
      setLoading(false);
      setQStart(Date.now());
    }
  };

  useEffect(() => {
    loadQuestions("balanced");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  // Resume any in-progress between-module break that survives tab switches
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BREAK_KEY);
      if (raw) {
        const t = Number(raw);
        if (Number.isFinite(t) && t > Date.now()) setBreakEndsAt(t);
        else localStorage.removeItem(BREAK_KEY);
      }
    } catch {}
  }, []);

  // Tick the break timer
  useEffect(() => {
    if (!breakEndsAt) return;
    const t = window.setInterval(() => setBreakTick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [breakEndsAt]);

  useEffect(() => {
    if (breakEndsAt && Date.now() >= breakEndsAt) {
      setBreakEndsAt(null);
      try { localStorage.removeItem(BREAK_KEY); } catch {}
    }
  }, [breakTick, breakEndsAt]);

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("copy", block);
    el.addEventListener("cut", block);
    el.addEventListener("paste", block);
    el.addEventListener("contextmenu", block);
    return () => {
      el.removeEventListener("copy", block);
      el.removeEventListener("cut", block);
      el.removeEventListener("paste", block);
      el.removeEventListener("contextmenu", block);
    };
  }, [loading]);

  useEffect(() => {
    if (done || loading || reviewing || breakEndsAt) return;
    const t = setInterval(() => {
      sessionTimeRef.current = Math.min(sessionTimeRef.current + 1, currentLimit);
      // Update the display ref directly to avoid full re-render
      if (timerDisplayRef.current) {
        timerDisplayRef.current.textContent = fmtTime(Math.max(0, currentLimit - sessionTimeRef.current));
      }
      // Sync state every 10s for effects that depend on sessionTime
      if (sessionTimeRef.current % 10 === 0) setSessionTime(sessionTimeRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [done, loading, reviewing, currentLimit, breakEndsAt]);

  useEffect(() => {
    if (!loading && !done && sessionTime >= currentLimit) setReviewing(true);
  }, [sessionTime, loading, done, currentLimit]);

  useEffect(() => {
    setQStart(Date.now());
  }, [idx, module]);

  const gradeCurrentModule = async () => {
    let correct = 0;
    let gained = 0;
    const tasks: Promise<any>[] = [];
    for (const qq of questions) {
      const answer = answers[qq.id];
      if (isCorrectAnswer(qq, answer)) {
        correct += 1;
        const sourceMistakeId = qq.id.startsWith("redo:") ? qq.id.split(":")[1] : null;
        if (sourceMistakeId) tasks.push(resolveMistake(sourceMistakeId));
        gained += xpForDifficulty(qq.difficulty);
      } else {
        const elapsed = timeByQuestion[qq.id] ?? Math.round(sessionTime / Math.max(1, questions.length));
        const reason: ErrorReason = elapsed > 90 ? "Time Pressure" : qq.section === "Reading & Writing" ? "Misreading" : "Concept Gap";
        tasks.push(recordMistake({ question: qq, userChoice: answerIndex(answer), timeSpent: elapsed, reason }));
      }
    }
    setXpEarned((x) => x + gained);
    await Promise.allSettled(tasks);
    return { correct, gained };
  };

  const persistAnnotations = async (sessionId: string | null, qSet: Question[]) => {
    const mergedFlags = { ...m1FlagDetails, ...flagDetails };
    const mergedElims = { ...m1Eliminations, ...eliminations };
    const rows = qSet
      .map((qq) => {
        const fd = mergedFlags[qq.id];
        const elim = mergedElims[qq.id];
        if (!fd && !elim) return null;
        return {
          user_id: profile?.id,
          session_id: sessionId,
          question_id: qq.id,
          question_prompt: qq.prompt.slice(0, 500),
          topic: qq.topic,
          section: qq.section,
          flag_category: fd?.category ?? null,
          flag_note: fd?.note ?? null,
          eliminations: elim ?? {},
        };
      })
      .filter(Boolean);
    if (!rows.length || !profile?.id) return;
    try {
      await supabase.from("question_annotations").insert(rows as any);
    } catch (e) { console.error("annotation save failed", e); }
  };

  const bumpPacingUsesIfNeeded = async () => {
    if (!showPacingCues) return;
    try { await supabase.rpc("increment_pacing_uses" as any); } catch {}
  };

  const buildMissedList = (qSet: Question[], aSet: Record<string, AnswerValue>): MissedQuestion[] =>
    qSet.filter((qq) => !isCorrectAnswer(qq, aSet[qq.id])).map((qq) => {
      const ans = aSet[qq.id];
      const userText = qq.responseType === "spr"
        ? (ans !== undefined ? String(ans) : "—")
        : (typeof ans === "number" ? `${String.fromCharCode(65 + ans)}. ${qq.choices[ans]}` : "—");
      const correctText = qq.responseType === "spr"
        ? (qq.correctText ?? qq.choices[qq.correct])
        : `${String.fromCharCode(65 + qq.correct)}. ${qq.choices[qq.correct]}`;
      return {
        question_id: qq.id,
        section: qq.section,
        topic: qq.topic,
        prompt: qq.prompt,
        user_answer: userText,
        correct_answer: correctText,
        explanation: qq.explanation,
        flag_category: (m1FlagDetails[qq.id] ?? flagDetails[qq.id])?.category ?? null,
        eliminations: (() => {
          const e = m1Eliminations[qq.id] ?? eliminations[qq.id];
          return e ? Object.fromEntries(Object.entries(e).map(([k, v]) => [String.fromCharCode(65 + Number(k)), v])) : {};
        })(),
      };
    });

  const finishSession = async (correct: number, total: number, sessionXpEarned: number) => {
    // Snapshot for the answer key BEFORE marking done so the UI can render it.
    const finalQuestions = [...questions];
    const finalAnswers = { ...answers };
    setAnswerKey({ questions: finalQuestions, answers: finalAnswers });
    setDone(true);
    // Compute combined missed list for the AI review dashboard.
    const allQ = moduleOneSnapshot ? [...moduleOneSnapshot.questions, ...finalQuestions] : finalQuestions;
    const allA = moduleOneSnapshot ? { ...moduleOneSnapshot.answers, ...finalAnswers } : finalAnswers;
    setPostReviewMissed(buildMissedList(allQ, allA));
    try {
      const res = await recordSession({
        mode: m,
        score: correct + completed.correct,
        total: total + completed.total,
        duration: sessionTimeRef.current + completed.seconds,
        xpEarned: sessionXpEarned,
      });
      const sessionId = (res as any)?.sessionId ?? null;
      // Persist annotations for both modules if full
      await persistAnnotations(sessionId, allQ);
      await bumpPacingUsesIfNeeded();
      if (taskLabel && dayLabel) await markTaskComplete({ taskKey: taskCompletionKey(dayLabel, taskLabel), taskLabel, dayLabel });
      // Re-sync profile from DB to ensure XP display is accurate everywhere
      await syncProfile();
    } catch (err: any) {
      // Don't bounce the user back on a sync hiccup — keep the results screen up.
      console.error("recordSession failed", err);
      toast({ title: "Saved locally", description: "Your session XP is in — sync will retry on reload.", variant: "destructive" });
    }
  };

  const proceedSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      stampTime();
      const result = await gradeCurrentModule();
      if (isFullLike && module === 1) {
        const harder = result.correct / Math.max(1, questions.length) >= 0.6;
        setCompleted({ correct: result.correct, total: questions.length, seconds: sessionTimeRef.current, xp: result.gained });
        setModuleOneSnapshot({ questions: [...questions], answers: { ...answers } });
        // Persist module-1 annotations now (session_id will land at final submit).
        setM1FlagDetails({ ...flagDetails });
        setM1Eliminations({ ...eliminations });
        // Start the 10-minute break IMMEDIATELY so the user sees it first
        const ends = Date.now() + BREAK_SECONDS * 1000;
        try { localStorage.setItem(BREAK_KEY, String(ends)); } catch {}
        setBreakEndsAt(ends);
        setReviewing(false);
        setModule(2);
        setIdx(0);
        setAnswers({});
        setFlagged(new Set());
        setFlagDetails({});
        setEliminations({});
        setTimeByQuestion({});
        setSessionTime(0);
        sessionTimeRef.current = 0;
        // Fire-and-forget: load module 2 in background while user is on break.
        // Loading screen will not show because the break screen takes precedence.
        loadQuestions(harder ? "harder" : "easier", 2).catch(() => {});
        return;
      }
      const sessionXpEarned = completed.xp + result.gained;
      setXpEarned(sessionXpEarned);
      await finishSession(result.correct, questions.length, sessionXpEarned);
      setReviewing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const skipBreak = () => {
    setBreakEndsAt(null);
    try { localStorage.removeItem(BREAK_KEY); } catch {}
  };

  // Between-module break screen — render BEFORE the loading screen so the
  // user sees the break first while module 2 generates in the background.
  if (breakEndsAt) {
    const left = Math.max(0, Math.round((breakEndsAt - Date.now()) / 1000));
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <div className="starfield" />
        <div className="glass glass-cyan p-10 max-w-md w-full text-center relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center mx-auto mb-4">
            <Coffee className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="font-display text-3xl font-bold">10-Minute Break</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Stretch, hydrate, reset. Math module starts when the timer hits zero — even if you switch tabs.
          </p>
          <div className="mt-6 font-display text-6xl font-bold tabular-nums">{fmtTime(left)}</div>
          <div className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            {loading ? "Preparing math questions in the background…" : "Math questions ready"}
          </div>
          <button onClick={skipBreak} disabled={loading} className="mt-6 px-5 py-2.5 rounded-lg border border-border bg-muted/30 text-sm font-medium disabled:opacity-50">
            {loading ? "Generating… please wait" : "Skip break and start Math now"}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="starfield" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-secondary animate-spin" />
          <div className="text-sm text-muted-foreground font-mono">Please wait while we generate unique questions…</div>
        </div>
      </div>
    );
  }

  if (!loading && questions.length === 0 && m !== "review") {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="starfield" />
        <div className="relative z-10 flex flex-col items-center gap-4 max-w-md text-center px-6">
          <AlertTriangle className="h-8 w-8 text-secondary" />
          <div className="font-display text-xl font-semibold">No questions loaded</div>
          <div className="text-sm text-muted-foreground">
            The AI generator hit a temporary issue (often a brief rate limit). Try again in a few seconds.
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => loadQuestions("balanced")}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-medium"
            >
              Retry
            </button>
            <button
              onClick={() => nav("/practice")}
              className="px-4 py-2 rounded-lg border border-border bg-muted/30 text-sm font-medium"
            >
              Back to Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[idx];

  if (done) {
    const correct = (answerKey?.questions ?? questions).filter((qq) => isCorrectAnswer(qq, (answerKey?.answers ?? answers)[qq.id])).length;
    const totalQ = (answerKey?.questions.length ?? questions.length) + completed.total;
    const totalCorrect = correct + completed.correct;
    // Build combined answer key: ELA from module-1 snapshot, Math from module-2 snapshot
    const ela = moduleOneSnapshot?.questions ?? [];
    const elaAns = moduleOneSnapshot?.answers ?? {};
    const math = (answerKey?.questions ?? []).filter((qq) => qq.section === "Math");
    const mathAns = answerKey?.answers ?? {};
    // For non-full modes, just sort current snapshot into the right tab
    const allQ = isFullLike ? [...ela, ...(answerKey?.questions ?? [])] : (answerKey?.questions ?? []);
    const allAns = isFullLike ? { ...elaAns, ...mathAns } : (answerKey?.answers ?? {});
    const elaList = allQ.filter((qq) => qq.section === "Reading & Writing");
    const mathList = allQ.filter((qq) => qq.section === "Math");

    // SAT-style score estimate (only meaningful for full simulation)
    const accToScore = (correct: number, total: number) => {
      if (total === 0) return 200;
      const pct = correct / total;
      // Map 0%→200, 100%→800 with a slight curve toward the middle
      return Math.round(200 + Math.pow(pct, 0.95) * 600);
    };
    const elaCorrect = elaList.filter((qq) => isCorrectAnswer(qq, allAns[qq.id])).length;
    const mathCorrect = mathList.filter((qq) => isCorrectAnswer(qq, allAns[qq.id])).length;
    const elaScore = accToScore(elaCorrect, elaList.length);
    const mathScore = accToScore(mathCorrect, mathList.length);
    const satTotal = elaScore + mathScore;

    const renderRow = (qq: Question, i: number) => {
      const ans = allAns[qq.id];
      const ok = isCorrectAnswer(qq, ans);
      const userText =
        qq.responseType === "spr"
          ? (ans !== undefined ? String(ans) : "—")
          : (typeof ans === "number" ? `${String.fromCharCode(65 + ans)}. ${qq.choices[ans]}` : "—");
      const correctText =
        qq.responseType === "spr"
          ? (qq.correctText ?? qq.choices[qq.correct])
          : `${String.fromCharCode(65 + qq.correct)}. ${qq.choices[qq.correct]}`;
      return (
        <div key={qq.id} className={`glass p-4 border ${ok ? "border-success/30" : "border-destructive/30"}`}>
          <div className="flex items-start gap-3">
            {ok ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Q{i + 1} · {qq.topic} · <span className="capitalize">{qq.difficulty}</span></div>
              <div className="text-sm mt-1 font-medium">{renderText(qq.prompt)}</div>
              <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs">
                <div className={`rounded border px-2 py-1.5 ${ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <span className="text-muted-foreground">Your answer: </span>{userText}
                </div>
                <div className="rounded border border-success/30 bg-success/5 px-2 py-1.5">
                  <span className="text-muted-foreground">Correct: </span>{correctText}
                </div>
              </div>
              {qq.explanation && <p className="mt-2 text-xs text-muted-foreground">{qq.explanation}</p>}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-background text-foreground relative">
        <div className="starfield" />
        <div className="relative z-10 max-w-3xl mx-auto px-5 py-10">
          <div className="glass glass-purple p-8 text-center animate-scale-in">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 glow-purple">
              <Rocket className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl font-bold">Mission Complete</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              You answered <span className="text-foreground font-semibold">{totalCorrect}</span> of {totalQ} correctly in <span className="font-mono">{fmtTime(sessionTimeRef.current + completed.seconds)}</span>.
            </p>
            <div className="mt-3 text-xs text-secondary">+{xpEarned} XP · Mistakes routed to your Vault</div>

            {isFullLike && (
              <div className="mt-6 grid sm:grid-cols-3 gap-3 text-left">
                <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reading & Writing</div>
                  <div className="font-display text-3xl font-bold mt-1">{elaScore}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{elaCorrect} / {elaList.length} correct</div>
                </div>
                <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Math</div>
                  <div className="font-display text-3xl font-bold mt-1">{mathScore}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{mathCorrect} / {mathList.length} correct</div>
                </div>
                <div className="rounded-lg border border-primary/40 bg-gradient-to-br from-primary/15 to-secondary/15 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-secondary">Predicted SAT</div>
                  <div className="font-display text-3xl font-bold mt-1">{satTotal}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">out of 1600</div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-2">
              <button onClick={() => nav("/app")} className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold">Return to Mission Control</button>
            </div>
          </div>

          {/* Unified Post-Test Review Dashboard (Answer Key + AI tabs) */}
          {m !== "review" && postReviewMissed !== null && (
            <PostTestReview
              missed={postReviewMissed}
              answerKey={(() => {
                const sortedMath = mathList.map((qq, i) => ({ qq, i }));
                const sortedEla = elaList.map((qq, i) => ({ qq, i }));
                return [...sortedMath, ...sortedEla].map(({ qq, i }) => {
                  const ans = allAns[qq.id];
                  const ok = isCorrectAnswer(qq, ans);
                  const userText = qq.responseType === "spr"
                    ? (ans !== undefined ? String(ans) : "—")
                    : (typeof ans === "number" ? `${String.fromCharCode(65 + ans)}. ${qq.choices[ans]}` : "—");
                  const correctText = qq.responseType === "spr"
                    ? (qq.correctText ?? qq.choices[qq.correct])
                    : `${String.fromCharCode(65 + qq.correct)}. ${qq.choices[qq.correct]}`;
                  return {
                    id: qq.id,
                    index: i,
                    section: qq.section,
                    topic: qq.topic,
                    difficulty: qq.difficulty,
                    prompt: qq.prompt,
                    userText,
                    correctText,
                    explanation: qq.explanation,
                    ok,
                  };
                });
              })()}
            />
          )}
          {/* Fallback simple answer key for mistake-review mode */}
          {m === "review" && (elaList.length > 0 || mathList.length > 0) && (
            <div className="mt-8">
              <h3 className="font-display text-2xl font-semibold mb-3">Answer Key</h3>
              <Tabs defaultValue={mathList.length >= elaList.length ? "math" : "ela"} className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="math">Math ({mathList.length})</TabsTrigger>
                  <TabsTrigger value="ela">ELA ({elaList.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="math" className="mt-4 space-y-3">
                  {mathList.length === 0 ? <div className="text-sm text-muted-foreground">No math questions.</div> : mathList.map((qq, i) => renderRow(qq, i))}
                </TabsContent>
                <TabsContent value="ela" className="mt-4 space-y-3">
                  {elaList.length === 0 ? <div className="text-sm text-muted-foreground">No ELA questions.</div> : elaList.map((qq, i) => renderRow(qq, i))}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!q) return null;
  const answered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== "";
  const answeredCount = questions.filter((qq) => answers[qq.id] !== undefined && String(answers[qq.id]).trim() !== "").length;
  const moduleAction = isFullLike && module === 1 ? "Submit ELA Module" : isFullLike ? "Submit Test" : "Submit Drill";

  if (reviewing) {
    return (
      <div className="min-h-screen bg-background text-foreground relative no-select">
        <div className="starfield" />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-5">
          <div className="glass glass-purple max-w-3xl w-full p-6 animate-scale-in">
            <div className="flex items-start gap-3 mb-5">
              <AlertTriangle className="h-5 w-5 text-warning mt-1" />
              <div>
                <h1 className="font-display text-2xl font-bold">Review before submitting</h1>
                <p className="text-sm text-muted-foreground mt-1">Flagged questions are marked. Choose a number to revisit it, or proceed to turn it in.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {questions.map((qq, i) => {
                const hasAnswer = answers[qq.id] !== undefined && String(answers[qq.id]).trim() !== "";
                const isFlagged = flagged.has(qq.id);
                const cat = flagDetails[qq.id]?.category;
                return (
                  <button key={qq.id} onClick={() => { setIdx(i); setReviewing(false); }} className={`relative min-h-[3.25rem] px-2 py-1.5 rounded-lg border text-sm font-mono transition-colors text-left ${hasAnswer ? "bg-primary/15 border-primary/40" : "bg-muted/20 border-border"}`}>
                    <span>{i + 1}</span>
                    {isFlagged && <Flag className="absolute right-1 top-1 h-3 w-3 text-warning fill-warning" />}
                    {isFlagged && cat && (
                      <div className="mt-1 text-[9px] leading-tight text-warning/90 truncate" title={cat}>{cat}</div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button onClick={() => setReviewing(false)} disabled={submitting} className="px-5 py-2.5 rounded-lg border border-border bg-muted/30 text-sm font-medium disabled:opacity-50">Go back</button>
              <button onClick={proceedSubmit} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting…" : "Proceed to turn it in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="min-h-screen bg-background text-foreground relative no-select">
      <div className="starfield" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="border-b border-border/60 backdrop-blur-xl bg-background/60">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-secondary">{exerciseName}</div>
              {isFullLike && <span className="text-xs px-2 py-0.5 rounded bg-muted border border-border font-mono">{module === 1 ? "ELA" : "Math"}</span>}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              {(() => {
                const expected = currentLimit * ((idx + 1) / Math.max(1, questions.length));
                const diff = sessionTime - expected; // positive = behind
                let cls = "text-muted-foreground";
                if (showPacingCues) {
                  if (diff > 30) cls = "text-destructive";
                  else if (Math.abs(diff) <= 10) cls = "text-success";
                  else cls = "text-warning";
                }
                return (
                  <span ref={timerDisplayRef} className={`flex items-center gap-1.5 ${cls}`} title={showPacingCues ? "Adaptive pace cue" : undefined}>
                    <Clock className="h-3.5 w-3.5" /> {fmtTime(Math.max(0, currentLimit - sessionTime))}
                  </span>
                );
              })()}
              <span>{idx + 1} / {questions.length}</span>
              <button onClick={() => setExitOpen(true)} className="p-1.5 rounded hover:bg-muted" aria-label="Exit"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="h-0.5 bg-muted"><div className="h-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
          {showPacingCues && (() => {
            // Two adaptive pacing bars:
            //  1) Per-question pace — where you should be on the current question vs how far the timer has run
            //  2) Overall test pace — whether you're on track to finish before the time limit
            const expectedQ = (idx + 1) / Math.max(1, questions.length); // 0..1
            const elapsedFrac = Math.max(0, Math.min(1, sessionTime / currentLimit));
            const qDiff = elapsedFrac - expectedQ; // >0 = behind on this question
            const overallExpected = answeredCount / Math.max(1, questions.length);
            const oDiff = elapsedFrac - overallExpected; // >0 = behind overall
            const color = (d: number) =>
              d > 0.05 ? "bg-destructive" : d < -0.05 ? "bg-warning" : "bg-success";
            const Bar = ({ label, frac, marker, diff }: { label: string; frac: number; marker: number; diff: number }) => (
              <div className="px-5 py-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  <span>{label}</span>
                  <span className={diff > 0.05 ? "text-destructive" : diff < -0.05 ? "text-warning" : "text-success"}>
                    {diff > 0.05 ? "Behind pace" : diff < -0.05 ? "Ahead of pace" : "On pace"}
                  </span>
                </div>
                <div className="relative h-1.5 rounded bg-muted overflow-hidden">
                  <div className={`h-full ${color(diff)} transition-all`} style={{ width: `${Math.min(100, frac * 100)}%` }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/70" style={{ left: `${Math.min(100, Math.max(0, marker * 100))}%` }} />
                </div>
              </div>
            );
            return (
              <div className="max-w-3xl mx-auto">
                <Bar label="This-question pace" frac={elapsedFrac} marker={expectedQ} diff={qDiff} />
                <Bar label="Overall test pace" frac={elapsedFrac} marker={overallExpected} diff={oDiff} />
              </div>
            );
          })()}
        </header>

        <div className="flex-1 flex items-start justify-center px-5 py-10">
          <div className="max-w-2xl w-full">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{q.section}{q.responseType === "spr" ? " · Student-produced response" : ""}</div>
            {q.passage && <div className="glass p-5 mb-5 text-sm leading-relaxed text-foreground/90">{renderText(q.passage)}</div>}
            <h2 className="font-display text-xl sm:text-2xl font-semibold leading-snug">{renderText(q.prompt)}</h2>

            {q.responseType === "spr" ? (
              <div className="mt-6 glass p-4">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Your answer</label>
                <input value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} inputMode="decimal" className="mt-2 w-full rounded-lg border border-border bg-background/50 px-4 py-3 font-mono text-lg outline-none focus:border-primary" placeholder="Enter a number or fraction" />
              </div>
            ) : (
              <div className="mt-6 space-y-2.5">
                {q.choices.map((c, i) => {
                  const isSel = answers[q.id] === i;
                  const elimTag = eliminations[q.id]?.[i];
                  return (
                    <div key={i} className={["w-full rounded-lg border text-sm transition-all flex items-stretch", isSel ? "border-primary/60 bg-primary/10" : "border-border bg-muted/30"].join(" ")}>
                      <button
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                        className={`flex-1 text-left px-4 py-3.5 flex items-start gap-3 ${elimTag ? "line-through opacity-50" : ""}`}
                      >
                        <span className="font-mono text-xs text-muted-foreground mt-0.5">{String.fromCharCode(65 + i)}</span>
                        <span className="flex-1">{renderText(c)}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (elimTag) {
                            // Toggle off: un-eliminate, no tag needed
                            setEliminations((prev) => {
                              const next = { ...prev };
                              const inner = { ...(next[q.id] ?? {}) };
                              delete inner[i];
                              if (Object.keys(inner).length === 0) delete next[q.id]; else next[q.id] = inner;
                              return next;
                            });
                          } else {
                            setElimPicker({ qid: q.id, choice: i });
                          }
                        }}
                        title={elimTag ? `Eliminated: ${elimTag} (click to undo)` : "Eliminate this choice"}
                        className="px-3 border-l border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        aria-label="Eliminate choice"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-border/60 bg-background/60 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
            <button
              onClick={() => {
                if (flagged.has(q.id)) {
                  // Toggle off
                  setFlagged((prev) => { const next = new Set(prev); next.delete(q.id); return next; });
                  setFlagDetails((prev) => { const next = { ...prev }; delete next[q.id]; return next; });
                } else {
                  setFlagPickerOpen(true);
                }
              }}
              className={`text-xs inline-flex items-center gap-1.5 ${flagged.has(q.id) ? "text-warning" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Flag className={`h-3.5 w-3.5 ${flagged.has(q.id) ? "fill-warning" : ""}`} />
              {flagged.has(q.id) ? `Flagged · ${flagDetails[q.id]?.category ?? ""}` : "Flag"}
            </button>
            <div className="flex items-center gap-2">
              {idx > 0 && <button onClick={() => { stampTime(); setIdx(idx - 1); }} className="px-4 py-2.5 rounded-lg border border-border bg-muted/30 text-sm font-medium">Back</button>}
              {idx === questions.length - 1 ? (
                <button onClick={() => { stampTime(); setReviewing(true); }} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold">{moduleAction}<ChevronRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={() => { stampTime(); setIdx(idx + 1); }} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold">Next<ChevronRight className="h-4 w-4" /></button>
              )}
            </div>
          </div>
        </footer>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you really want to exit this session?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose all your progress and XP for this {exerciseName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep going</AlertDialogCancel>
            <AlertDialogAction onClick={() => nav("/practice")}>Yes, exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <FlagCategoryPicker
        open={flagPickerOpen}
        initialCategory={flagDetails[q?.id ?? ""]?.category}
        initialNote={flagDetails[q?.id ?? ""]?.note}
        onCancel={() => setFlagPickerOpen(false)}
        onConfirm={(category, note) => {
          if (!q) return;
          setFlagged((prev) => new Set(prev).add(q.id));
          setFlagDetails((prev) => ({ ...prev, [q.id]: { category, note } }));
          setFlagPickerOpen(false);
        }}
      />
      <ChoiceEliminator
        open={!!elimPicker}
        choiceLetter={elimPicker ? String.fromCharCode(65 + elimPicker.choice) : ""}
        subject={(() => {
          const tq = elimPicker ? questions.find((qq) => qq.id === elimPicker.qid) : undefined;
          return tq?.section === "Math" ? "math" : "ela";
        })()}
        onCancel={() => setElimPicker(null)}
        onConfirm={(tag) => {
          if (!elimPicker) return;
          setEliminations((prev) => ({
            ...prev,
            [elimPicker.qid]: { ...(prev[elimPicker.qid] ?? {}), [elimPicker.choice]: tag },
          }));
          setElimPicker(null);
        }}
      />
    </div>
  );
};

export default TestSession;
