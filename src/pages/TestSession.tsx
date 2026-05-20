import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Clock, Flag, X, ChevronRight, Rocket, Loader as Loader2, TriangleAlert as AlertTriangle, Coffee, CircleCheck as CheckCircle2, Circle as XCircle, Cookie } from "lucide-react";
import { Question, ErrorReason, xpForDifficulty } from "@/lib/novaprep-data";
import { useNova } from "@/lib/novaprep-store";
import { generateQuestions } from "@/lib/generate-questions";
import { sanitizeMath } from "@/lib/sanitize-math";
import { toast } from "@/hooks/use-toast";
import { taskCompletionKey } from "@/lib/practice-links";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

type Mode = "full" | "reading" | "math" | "redemption" | "review";
type AnswerValue = number | string;

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const MODULE_SIZE: Record<Mode, number> = { full: 54, reading: 27, math: 44, redemption: 12, review: 10 };
const MODULE_LIMIT: Record<Mode, number> = { full: 64 * 60, reading: 32 * 60, math: 70 * 60, redemption: 18 * 60, review: 15 * 60 };
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
const answerIndex = (q: Question, answer: AnswerValue | undefined) => typeof answer === "number" ? answer : q.correct;

const TestSession = () => {
  const { mode = "full" } = useParams();
  const m = mode as Mode;
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const recordMistake = useNova((s) => s.recordMistake);
  const awardXP = useNova((s) => s.awardXP);
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
  const currentLimit = m === "full" ? (module === 1 ? 64 * 60 : 70 * 60) : MODULE_LIMIT[m];
  const exerciseName =
    m === "full" ? "Full SAT Simulation" :
    m === "reading" ? "Reading & Writing drill" :
    m === "math" ? "Math drill" :
    m === "redemption" ? "Weak-area redemption drill" :
    "Mistake review";

  // Question-time buffs available in inventory
  const questionBuffs = useMemo(() =>
    inventory.filter((item) => isQuestionTimeBoost(item.kind)),
    [inventory]
  );

  const useBuff = async (kind: BoostKind) => {
    const item = questionBuffs.find((i) => i.kind === kind);
    if (!item) return;
    const q = questions[idx];
    if (!q) return;

    switch (kind) {
      case "fifty_fifty": {
        // Eliminate 2 wrong choices (only for multiple choice with 4 options)
        if (q.responseType === "spr") {
          toast({ title: "Can't use 50/50 here", description: "This is a student-produced response question.", variant: "destructive" });
          return;
        }
        const wrongIndices = q.choices.map((_, i) => i).filter((i) => i !== q.correct && !eliminatedChoices.has(i));
        const toEliminate = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
        setEliminatedChoices(new Set([...eliminatedChoices, ...toEliminate]));
        // If current answer is eliminated, clear it
        if (typeof answers[q.id] === "number" && toEliminate.includes(answers[q.id] as number)) {
          setAnswers((a) => { const next = { ...a }; delete next[q.id]; return next; });
        }
        break;
      }
      case "hint": {
        setHintShown(true);
        break;
      }
      case "extra_life": {
        setExtraLifeUsed(true);
        setExtraLifeMistakeShield(true);
        toast({ title: "Extra Life armed", description: "Your next wrong answer won't be added to the Vault." });
        break;
      }
      case "skip_token": {
        // Mark as skipped (counts as done) and advance
        setAnswers((a) => ({ ...a, [q.id]: "__skipped__" }));
        stampTime();
        if (idx < questions.length - 1) setIdx(idx + 1);
        else setReviewing(true);
        break;
      }
      case "topic_radar": {
        toast({ title: "Topic Radar", description: `This question covers: ${q.topic} (${q.difficulty})` });
        break;
      }
    }

    // Consume the item from inventory
    await consumeInventoryItem(item.id);
  };

  // Reset per-question buff state when moving to a new question
  useEffect(() => {
    setEliminatedChoices(new Set());
    setHintShown(false);
    setExtraLifeUsed(false);
  }, [idx]);

  const cleanExplanation = (text: string) =>
    text
      .replace(/<tool_call>[\s\S]*?<\/think>/gi, "")
      .replace(/(^|\n)\s*(reasoning|chain of thought|internal thinking)\s*:[\s\S]*/gi, "")
      .replace(/\\n/g, "\n")
      .trim();

  const stampTime = () => {
    const elapsed = Math.round((Date.now() - qStart) / 1000);
    const current = questions[idx];
    if (current) setTimeByQuestion((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + elapsed }));
  };

  const prepareQuestions = (qs: Question[]): Question[] => qs.map((question): Question => shuffleChoices({
    ...question,
    responseType: question.responseType === "spr" ? "spr" : "multiple-choice",
    explanation: cleanExplanation(question.explanation),
  }));

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
        const requestedSection = m === "full" ? fullSection : modeSection;
        const modeTopic = requestedTopic && requestedTopic !== "Mixed SAT Skills" ? requestedTopic : undefined;
        // Request extra questions to account for potential section mismatches
        const requestCount = m === "full" ? (targetModule === 1 ? 54 : 44) : MODULE_SIZE[m] + 6;
        const qs = await generateQuestions({
          mode: m === "review" ? "redemption" : m,
          count: requestCount,
          difficultyBias: bias,
          topic: m === "redemption" ? weakTopic : modeTopic,
          section: requestedSection ?? undefined,
        });
        // Filter to only include questions matching the requested section
        const filtered = requestedSection
          ? qs.filter((q) => q.section === requestedSection)
          : qs;
        const targetCount = m === "full" ? (targetModule === 1 ? 54 : 44) : MODULE_SIZE[m];
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
    let extraLifeAvailable = extraLifeMistakeShield;
    const tasks: Promise<any>[] = [];
    for (const qq of questions) {
      const answer = answers[qq.id];
      if (isCorrectAnswer(qq, answer)) {
        correct += 1;
        const sourceMistakeId = qq.id.startsWith("redo:") ? qq.id.split(":")[1] : null;
        if (sourceMistakeId) tasks.push(resolveMistake(sourceMistakeId));
        gained += xpForDifficulty(qq.difficulty);
      } else if (answer !== undefined && !isSkipped(answer)) {
        const elapsed = timeByQuestion[qq.id] ?? Math.round(sessionTime / Math.max(1, questions.length));
        const reason: ErrorReason = elapsed > 90 ? "Time Pressure" : qq.section === "Reading & Writing" ? "Misreading" : "Concept Gap";
        if (extraLifeAvailable) extraLifeAvailable = false;
        else tasks.push(recordMistake({ question: qq, userChoice: answerIndex(qq, answer), timeSpent: elapsed, reason }));
      }
    }
    if (extraLifeMistakeShield && !extraLifeAvailable) setExtraLifeMistakeShield(false);
    // Apply XP optimistically in one shot — no per-question DB round-trips
    const mult = xpMultiplierFromBoosts(useNova.getState().profile?.active_boosts ?? []);
    gained *= mult;
    const profile = useNova.getState().profile;
    if (profile) {
      useNova.setState({ profile: { ...profile, xp: profile.xp + gained, streak: Math.max(1, profile.streak || 0) } });
    }
    setXpEarned((x) => x + gained);
    // Fire mistake recording in background — don't block the UI
    Promise.allSettled(tasks).catch(() => {});
    return { correct, gained };
  };

  const finishSession = async (correct: number, total: number, gained: number) => {
    // Snapshot for the answer key BEFORE marking done so the UI can render it.
    setAnswerKey({ questions: [...questions], answers: { ...answers } });
    setDone(true);
    try {
      await recordSession({
        mode: m,
        score: correct + completed.correct,
        total: total + completed.total,
        duration: sessionTimeRef.current + completed.seconds,
        xpEarned: xpEarned + completed.xp + gained,
      });
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
      if (m === "full" && module === 1) {
        const harder = result.correct / Math.max(1, questions.length) >= 0.6;
        setCompleted({ correct: result.correct, total: questions.length, seconds: sessionTimeRef.current, xp: result.gained });
        setModuleOneSnapshot({ questions: [...questions], answers: { ...answers } });
        // Start the 10-minute break IMMEDIATELY so the user sees it first
        const ends = Date.now() + BREAK_SECONDS * 1000;
        try { localStorage.setItem(BREAK_KEY, String(ends)); } catch {}
        setBreakEndsAt(ends);
        setReviewing(false);
        setModule(2);
        setIdx(0);
        setAnswers({});
        setFlagged(new Set());
        setTimeByQuestion({});
        setSessionTime(0);
        sessionTimeRef.current = 0;
        // Fire-and-forget: load module 2 in background while user is on break.
        // Loading screen will not show because the break screen takes precedence.
        loadQuestions(harder ? "harder" : "easier", 2).catch(() => {});
        return;
      }
      await finishSession(result.correct, questions.length, result.gained);
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
          <div className="text-sm text-muted-foreground font-mono">Generating unique questions…</div>
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
    const allQ = m === "full" ? [...ela, ...(answerKey?.questions ?? [])] : (answerKey?.questions ?? []);
    const allAns = m === "full" ? { ...elaAns, ...mathAns } : (answerKey?.answers ?? {});
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
            <div className="mt-3 text-xs text-secondary">+{xpEarned + completed.xp} XP · Mistakes routed to your Vault</div>

            {m === "full" && (
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

            {m === "math" ? (
              <div className="mt-6 grid gap-2">
                <button onClick={() => { window.location.href = "/test/reading"; }} className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold">Continue to Reading & Writing</button>
                <button onClick={() => nav("/")} className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted/30 text-sm">Back to dashboard</button>
              </div>
            ) : m === "reading" ? (
              <div className="mt-6 grid gap-2">
                <button onClick={() => { window.location.href = "/test/math"; }} className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold">Continue to Math</button>
                <button onClick={() => nav("/")} className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted/30 text-sm">Back to dashboard</button>
              </div>
            ) : (
              <button onClick={() => nav("/")} className="mt-6 inline-block w-full px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold">Return to Mission Control</button>
            )}
          </div>

          {/* Answer Key with Math / ELA tabs */}
          {(elaList.length > 0 || mathList.length > 0) && (
            <div className="mt-8">
              <h3 className="font-display text-2xl font-semibold mb-3">Answer Key</h3>
              <Tabs defaultValue={mathList.length >= elaList.length ? "math" : "ela"} className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="math">Math ({mathList.length})</TabsTrigger>
                  <TabsTrigger value="ela">ELA ({elaList.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="math" className="mt-4 space-y-3">
                  {mathList.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No math questions in this session.</div>
                  ) : mathList.map((qq, i) => renderRow(qq, i))}
                </TabsContent>
                <TabsContent value="ela" className="mt-4 space-y-3">
                  {elaList.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No ELA questions in this session.</div>
                  ) : elaList.map((qq, i) => renderRow(qq, i))}
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
  const moduleAction = m === "full" && module === 1 ? "Submit ELA Module" : m === "full" ? "Submit Test" : "Submit Drill";

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
            <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-11 gap-2">
              {questions.map((qq, i) => {
                const hasAnswer = answers[qq.id] !== undefined && String(answers[qq.id]).trim() !== "";
                const isFlagged = flagged.has(qq.id);
                return (
                  <button key={qq.id} onClick={() => { setIdx(i); setReviewing(false); }} className={`relative h-11 rounded-lg border text-sm font-mono transition-colors ${hasAnswer ? "bg-primary/15 border-primary/40" : "bg-muted/20 border-border"}`}>
                    {i + 1}
                    {isFlagged && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 text-warning fill-warning" />}
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
              {m === "full" && <span className="text-xs px-2 py-0.5 rounded bg-muted border border-border font-mono">{module === 1 ? "ELA" : "Math"}</span>}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span ref={timerDisplayRef} className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {fmtTime(Math.max(0, currentLimit - sessionTime))}</span>
              <span>{idx + 1} / {questions.length}</span>
              <button onClick={() => setExitOpen(true)} className="p-1.5 rounded hover:bg-muted" aria-label="Exit"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="h-0.5 bg-muted"><div className="h-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
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
                  const isEliminated = eliminatedChoices.has(i);
                  if (isEliminated) return (
                    <div key={i} className="w-full text-left px-4 py-3.5 rounded-lg border border-border/30 bg-muted/10 text-sm flex items-start gap-3 opacity-40 line-through cursor-not-allowed">
                      <span className="font-mono text-xs text-muted-foreground mt-0.5">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{renderText(c)}</span>
                    </div>
                  );
                  return (
                    <button key={i} onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))} className={["w-full text-left px-4 py-3.5 rounded-lg border text-sm transition-all flex items-start gap-3", isSel ? "border-primary/60 bg-primary/10" : "border-border bg-muted/30 hover:border-secondary/50 hover:bg-muted/50"].join(" ")}>
                      <span className="font-mono text-xs text-muted-foreground mt-0.5">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{renderText(c)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Hint display */}
            {hintShown && q.explanation && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-warning inline mr-1.5" />
                <span className="font-medium text-warning">Hint:</span> {q.explanation.split(".")[0]}.
              </div>
            )}

            {/* Question-time buff bar */}
            {questionBuffs.length > 0 && (
              <div className="mt-5 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">Buffs:</span>
                {(() => {
                  const buffCounts = new Map<string, InventoryItem[]>();
                  for (const b of questionBuffs) {
                    const list = buffCounts.get(b.kind) ?? [];
                    list.push(b);
                    buffCounts.set(b.kind, list);
                  }
                  return [...buffCounts.entries()].map(([kind, items]) => {
                    const Icon = buffIcon[kind];
                    if (!Icon) return null;
                    return (
                      <button
                        key={kind}
                        onClick={() => useBuff(kind as BoostKind)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {buffLabel[kind] ?? kind}
                        {items.length > 1 && <span className="text-muted-foreground">x{items.length}</span>}
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-border/60 bg-background/60 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
            <button onClick={() => setFlagged((prev) => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; })} className={`text-xs inline-flex items-center gap-1.5 ${flagged.has(q.id) ? "text-warning" : "text-muted-foreground hover:text-foreground"}`}>
              <Flag className={`h-3.5 w-3.5 ${flagged.has(q.id) ? "fill-warning" : ""}`} /> Flag
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
    </div>
  );
};

export default TestSession;
