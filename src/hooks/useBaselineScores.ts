import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BaselineScore } from "@/lib/baseline-scores";

/** Real SAT / PSAT / DSAT / Bluebook scores the student has already earned. */
export function useBaselineScores() {
  const { user } = useAuth();
  const [scores, setScores] = useState<BaselineScore[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setScores([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("baseline_scores")
      .select("*")
      .order("taken_on", { ascending: false });
    if (!error) setScores((data ?? []) as BaselineScore[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (entry: Omit<BaselineScore, "id">) => {
    if (!user) return false;
    const { error } = await supabase.from("baseline_scores").insert({
      user_id: user.id,
      test_type: entry.test_type,
      test_label: entry.test_label,
      rw_score: entry.rw_score,
      math_score: entry.math_score,
      taken_on: entry.taken_on,
    });
    if (error) return false;
    await refresh();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("baseline_scores").delete().eq("id", id);
    if (error) return false;
    setScores((prev) => prev.filter((s) => s.id !== id));
    return true;
  };

  return { scores, loading, add, remove, refresh };
}
