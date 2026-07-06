import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Swords, Trophy } from "lucide-react";

type DuelRow = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  section: string;
  status: string;
  questions: any[];
  winner_id: string | null;
};

type AnswerRow = { user_id: string; q_index: number; correct: boolean };

export default function Duel() {
  const { id } = useParams();
  const { user } = useAuth();
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const startedAt = useRef<number>(Date.now());

  // Load duel
  useEffect(() => {
    supabase.from("duels").select("*").eq("id", id!).maybeSingle().then(({ data }) => {
      setDuel(data as DuelRow);
    });
  }, [id]);

  // Realtime answers
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from("duel_answers").select("user_id,q_index,correct").eq("duel_id", id);
      setAnswers((data as AnswerRow[]) ?? []);
    };
    load();
    const channel = supabase
      .channel(`duel-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_answers", filter: `duel_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${id}` }, (p) => setDuel(p.new as DuelRow))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const myAnswers = answers.filter((a) => a.user_id === user?.id);
  const oppId = duel && (user?.id === duel.challenger_id ? duel.opponent_id : duel.challenger_id);
  const oppAnswers = answers.filter((a) => a.user_id === oppId);

  const questions = duel?.questions ?? [];
  const q = questions[qIdx];

  useEffect(() => { startedAt.current = Date.now(); setLocked(false); }, [qIdx]);

  async function answer(choiceIdx: number) {
    if (!duel || locked || !q) return;
    setLocked(true);
    const correct = choiceIdx === q.correct;
    const timeMs = Date.now() - startedAt.current;
    await supabase.rpc("submit_duel_answer", { _duel_id: duel.id, _q_index: qIdx, _correct: correct, _time_ms: timeMs });
    setTimeout(() => {
      if (qIdx + 1 < questions.length) setQIdx(qIdx + 1);
      else supabase.rpc("finalize_duel", { _duel_id: duel.id });
    }, 700);
  }

  const myScore = myAnswers.filter((a) => a.correct).length;
  const oppScore = oppAnswers.filter((a) => a.correct).length;

  if (!duel) return <AppLayout><div className="text-muted-foreground">Loading duel…</div></AppLayout>;

  if (duel.status === "complete") {
    const iWon = duel.winner_id === user?.id;
    return (
      <AppLayout>
        <GlassCard variant={iWon ? "purple" : "cyan"} className="text-center py-10">
          <Trophy className="h-12 w-12 mx-auto text-secondary mb-3" />
          <h1 className="font-display text-4xl font-bold">
            {duel.winner_id === null ? "Tie!" : iWon ? "Victory!" : "Defeated"}
          </h1>
          <p className="mt-2 text-muted-foreground">Final score {myScore} – {oppScore}</p>
          <p className="mt-1 text-xs text-muted-foreground">+{iWon ? 30 : 10} XP awarded</p>
        </GlassCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-secondary">Duel</span>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Swords className="h-6 w-6" /> {duel.section}</h1>
        </div>
        <div className="text-sm font-mono">
          You {myScore} · {oppScore} Opp
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        Question {qIdx + 1}/{questions.length} · Opponent on Q{oppAnswers.length + 1}
      </div>

      {q ? (
        <GlassCard>
          <div className="whitespace-pre-wrap text-sm mb-4">{q.prompt}</div>
          <div className="grid gap-2">
            {(q.choices as string[]).map((c, i) => (
              <button
                key={i}
                onClick={() => answer(i)}
                disabled={locked}
                className="text-left px-4 py-3 rounded-lg border border-border bg-background/40 hover:bg-muted/40 disabled:opacity-60"
              >
                <span className="font-mono text-secondary mr-2">{String.fromCharCode(65 + i)}.</span> {c}
              </button>
            ))}
          </div>
        </GlassCard>
      ) : (
        <div className="text-sm text-muted-foreground">Waiting for opponent to finish…</div>
      )}
    </AppLayout>
  );
}
