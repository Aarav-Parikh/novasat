import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNova } from "@/lib/novaprep-store";
import { deriveNovaStats } from "@/lib/novaprep-stats";
import { rankFromXP } from "@/lib/novaprep-data";
import { BADGE_CATALOG, unlockedBadgeKeys, BadgeState } from "@/lib/badges";
import { showBadgeToast } from "./BadgeToast";

const storageKey = (uid: string) => `novaprep:badges-seen:${uid}`;

export function BadgeWatcher() {
  const { user } = useAuth();
  const profile = useNova((s) => s.profile);
  const sessions = useNova((s) => s.sessions);
  const mistakes = useNova((s) => s.mistakes);
  const primed = useRef(false);

  useEffect(() => {
    if (!user?.id || !profile) return;
    const xp = profile.xp ?? 0;
    const rank = rankFromXP(xp);
    const stats = deriveNovaStats(sessions, mistakes, xp, profile.target_score);
    const state: BadgeState = {
      sessions: sessions.length,
      accuracy: stats.accuracy,
      bestAccuracy: stats.bestAccuracy,
      mistakes: mistakes.length,
      streak: profile.streak ?? 0,
      xp,
      sp: profile.sp ?? 0,
      hours: stats.hoursLogged,
      level: rank.level,
      targetScore: profile.target_score,
      testDate: profile.test_date,
      avgPace: stats.avgPace,
      projected: stats.projectedScore,
      inventory: 0,
    };
    const currentKeys = unlockedBadgeKeys(state);
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(storageKey(user.id)) ?? "[]");
    } catch {
      stored = [];
    }
    const newlyUnlocked = currentKeys.filter((k) => !stored.includes(k));
    // First mount for this user: prime, don't spam
    if (!primed.current) {
      primed.current = true;
      if (stored.length === 0) {
        localStorage.setItem(storageKey(user.id), JSON.stringify(currentKeys));
        return;
      }
    }
    if (newlyUnlocked.length > 0) {
      for (const key of newlyUnlocked) {
        const badge = BADGE_CATALOG.find((b) => b.key === key);
        if (badge) showBadgeToast(badge);
      }
      localStorage.setItem(storageKey(user.id), JSON.stringify(currentKeys));
    }
  }, [user?.id, profile, sessions, mistakes]);

  return null;
}
