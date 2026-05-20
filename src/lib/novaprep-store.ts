import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import {
  MistakeRecord,
  Question,
  Difficulty,
  ErrorReason,
  xpForDifficulty,
} from "./novaprep-data";

export type BoostKind =
  | "xp_2x"
  | "xp_3x"
  | "sp_2x"
  | "streak_freeze"
  | "skip_token"
  | "hint"
  | "fifty_fifty"
  | "extra_life"
  | "topic_radar";

// Question-time buffs can only be used during a test session, not pre-activated
export const QUESTION_TIME_BUFFS: BoostKind[] = [
  "fifty_fifty",
  "hint",
  "extra_life",
  "skip_token",
  "topic_radar",
];

export const isQuestionTimeBoost = (kind: BoostKind) => QUESTION_TIME_BUFFS.includes(kind);

// Buff categories:
// - "activated": user manually triggers (during test or from inventory)
// - "instant": auto-applies on acquisition (no user action needed)
export type BuffCategory = "activated" | "instant";

export const BUFF_CATEGORY: Record<BoostKind, BuffCategory> = {
  // Instant — auto-applied as soon as you receive them
  xp_2x: "instant",
  xp_3x: "instant",
  sp_2x: "instant",
  streak_freeze: "instant",
  // Activated — you click to use them, in test or from inventory
  fifty_fifty: "activated",
  hint: "activated",
  skip_token: "activated",
  topic_radar: "activated",
  extra_life: "activated",
};

const VALID_BOOSTS = new Set<BoostKind>(Object.keys(BUFF_CATEGORY) as BoostKind[]);

export const isInstantBoost = (kind: BoostKind) => BUFF_CATEGORY[kind] === "instant";
export const isActivatedBoost = (kind: BoostKind) => BUFF_CATEGORY[kind] === "activated";

export interface InventoryItem {
  id: string; // uuid in JS
  kind: BoostKind;
  label: string;
  minutes?: number; // for timed boosts
  acquired_at: string;
}

export interface ActiveBoost {
  id: string;
  kind: BoostKind;
  label: string;
  expires_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  target_score: number | null;
  test_date: string | null;
  xp: number;
  streak: number;
  sp: number;
  xp_boost_until?: string | null; // legacy, kept for back-compat
  inventory: InventoryItem[];
  active_boosts: ActiveBoost[];
  focus_minutes_total: number;
}

export type BoxReward =
  | { type: "sp"; amount: number; label: string }
  | { type: "xp_boost"; multiplier: 2; minutes: number; label: string }
  | { type: "boost"; kind: BoostKind; label: string; minutes?: number };

export interface SessionSummary {
  id: string;
  created_at: string;
  score: number;
  total: number;
  duration_seconds: number;
  mode: string;
  xp_earned: number;
}

export interface TaskCompletion {
  id: string;
  task_key: string;
  task_label: string;
  day_label: string;
  completed_on: string;
}

export interface MysteryBox {
  id: string;
  level_number: number;
  tier: "common" | "rare" | "epic" | "legendary";
  upgrade_clicks_used: number;
  reward_label: string | null;
  opened_at: string | null;
  claimed_at: string | null;
  reward_payload?: BoxReward | null;
  created_at: string;
  updated_at: string;
}

export interface StoreItem {
  id: string;
  kind: BoostKind;
  label: string;
  description: string;
  cost: number;
  minutes?: number;
}

export interface FocusTimerState {
  duration: number; // seconds
  endsAt: number | null; // epoch ms when timer should end (null = paused)
  remaining: number; // last known remaining seconds (for paused state)
  running: boolean;
}

interface NovaState {
  profile: Profile | null;
  mistakes: MistakeRecord[];
  sessions: SessionSummary[];
  taskCompletions: TaskCompletion[];
  mysteryBoxes: MysteryBox[];
  loading: boolean;
  focusTimer: FocusTimerState;
  setFocusDuration: (seconds: number) => void;
  startFocusTimer: () => void;
  pauseFocusTimer: () => void;
  resetFocusTimer: () => void;
  completeFocusTimer: () => Promise<number>;
  loadAll: (userId: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "target_score" | "test_date">>) => Promise<void>;
  markTaskComplete: (task: { taskKey: string; taskLabel: string; dayLabel: string }) => Promise<void>;
  syncBoxes: () => Promise<void>;
  upgradeMysteryBox: (boxId: string) => Promise<MysteryBox | null>;
  openMysteryBox: (boxId: string) => Promise<BoxReward | null>;
  buyStoreItem: (item: StoreItem) => Promise<boolean>;
  activateInventoryItem: (itemId: string) => Promise<boolean>;
  consumeInventoryItem: (itemId: string) => Promise<boolean>;
  pruneExpiredBoosts: () => Promise<void>;
  awardFocusXP: (minutes: number) => Promise<number>;
  recordMistake: (m: {
    question: Question;
    userChoice: number;
    timeSpent: number;
    reason: ErrorReason;
  }) => Promise<void>;
  awardXP: (difficulty: Difficulty) => Promise<number>;
  syncProfile: () => Promise<void>;
  recordSession: (s: {
    mode: string;
    score: number;
    total: number;
    duration: number;
    xpEarned: number;
  }) => Promise<void>;
  resolveMistake: (id: string) => Promise<void>;
  claimDailySP: (amount: number) => Promise<boolean>;
  reset: () => void;
}

const todayDate = () => new Date().toISOString().slice(0, 10);
const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const dedupeMistakes = (mistakes: MistakeRecord[]) =>
  Array.from(
    new Map(
      mistakes.map((mistake) => [
        `${mistake.section}::${mistake.topic}::${mistake.prompt}`,
        mistake,
      ]),
    ).values(),
  );

const REMOVED_BOOSTS = new Set<BoostKind>(["skip_token", "topic_radar", "extra_life"]);

const normalizeProfile = (raw: any): Profile | null => {
  if (!raw) return null;
  return {
    ...raw,
    inventory: Array.isArray(raw.inventory) ? (raw.inventory as InventoryItem[]).filter((item) => VALID_BOOSTS.has(item.kind) && !REMOVED_BOOSTS.has(item.kind)) : [],
    active_boosts: Array.isArray(raw.active_boosts) ? (raw.active_boosts as ActiveBoost[]).filter((boost) => VALID_BOOSTS.has(boost.kind) && !REMOVED_BOOSTS.has(boost.kind)) : [],
    focus_minutes_total: raw.focus_minutes_total ?? 0,
    sp: raw.sp ?? 0,
  };
};

const filterLiveBoosts = (list: ActiveBoost[]) =>
  list.filter((b) => new Date(b.expires_at).getTime() > Date.now());

export const xpMultiplierFromBoosts = (boosts: ActiveBoost[]) => {
  const live = filterLiveBoosts(boosts);
  if (live.some((b) => b.kind === "xp_3x")) return 3;
  if (live.some((b) => b.kind === "xp_2x")) return 2;
  return 1;
};

export const spMultiplierFromBoosts = (boosts: ActiveBoost[]) =>
  filterLiveBoosts(boosts).some((b) => b.kind === "sp_2x") ? 2 : 1;

const hasLiveBoost = (boosts: ActiveBoost[], kind: BoostKind) =>
  filterLiveBoosts(boosts).some((boost) => boost.kind === kind);

const rewardForTier = (tier: MysteryBox["tier"]): BoxReward => {
  const roll = Math.random();
  if (tier === "common") {
    if (roll < 0.40) return { type: "sp", amount: 5, label: "5 SP" };
    if (roll < 0.65) return { type: "xp_boost", multiplier: 2, minutes: 10, label: "2x XP · 10 min" };
    if (roll < 0.82) return { type: "boost", kind: "hint", label: "Hint Token" };
    if (roll < 0.94) return { type: "boost", kind: "fifty_fifty", label: "50/50 Eliminator" };
    return { type: "boost", kind: "streak_freeze", label: "Streak Freeze" };
  }
  if (tier === "rare") {
    if (roll < 0.30) return { type: "sp", amount: 10, label: "10 SP" };
    if (roll < 0.55) return { type: "xp_boost", multiplier: 2, minutes: 20, label: "2x XP · 20 min" };
    if (roll < 0.72) return { type: "boost", kind: "fifty_fifty", label: "50/50 Eliminator" };
    if (roll < 0.86) return { type: "boost", kind: "streak_freeze", label: "Streak Freeze" };
    return { type: "sp", amount: 20, label: "20 SP" };
  }
  if (tier === "epic") {
    if (roll < 0.30) return { type: "sp", amount: 20, label: "20 SP" };
    if (roll < 0.55) return { type: "xp_boost", multiplier: 2, minutes: 30, label: "2x XP · 30 min" };
    if (roll < 0.75) return { type: "boost", kind: "fifty_fifty", label: "50/50 Eliminator" };
    if (roll < 0.88) return { type: "boost", kind: "streak_freeze", label: "Streak Freeze" };
    return { type: "sp", amount: 40, label: "40 SP" };
  }
  // Legendary
  if (roll < 0.25) return { type: "sp", amount: 40, label: "40 SP" };
  if (roll < 0.50) return { type: "xp_boost", multiplier: 2, minutes: 60, label: "2x XP · 1 hr" };
  if (roll < 0.70) return { type: "boost", kind: "xp_3x", label: "3x XP · 30 min", minutes: 30 };
  if (roll < 0.88) return { type: "boost", kind: "fifty_fifty", label: "50/50 Eliminator" };
  return { type: "boost", kind: "sp_2x", label: "2x SP · 30 min", minutes: 30 };
};

const inventoryFromReward = (reward: BoxReward): InventoryItem | null => {
  if (reward.type === "xp_boost") {
    return {
      id: uid(),
      kind: "xp_2x",
      label: reward.label,
      minutes: reward.minutes,
      acquired_at: new Date().toISOString(),
    };
  }
  if (reward.type === "boost") {
    return {
      id: uid(),
      kind: reward.kind,
      label: reward.label,
      minutes: reward.minutes,
      acquired_at: new Date().toISOString(),
    };
  }
  return null;
};

const FOCUS_KEY = "novaprep:focus-timer";
const loadFocus = (): FocusTimerState => {
  if (typeof window === "undefined") return { duration: 25 * 60, endsAt: null, remaining: 25 * 60, running: false };
  try {
    const raw = window.localStorage.getItem(FOCUS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FocusTimerState;
      if (parsed.running && parsed.endsAt) {
        const left = Math.max(0, Math.round((parsed.endsAt - Date.now()) / 1000));
        return { ...parsed, remaining: left, running: left > 0 };
      }
      return parsed;
    }
  } catch {}
  return { duration: 25 * 60, endsAt: null, remaining: 25 * 60, running: false };
};
const saveFocus = (f: FocusTimerState) => {
  try { window.localStorage.setItem(FOCUS_KEY, JSON.stringify(f)); } catch {}
};

export const useNova = create<NovaState>((set, get) => ({
  profile: null,
  mistakes: [],
  sessions: [],
  taskCompletions: [],
  mysteryBoxes: [],
  loading: false,
  focusTimer: loadFocus(),

  setFocusDuration: (seconds) => {
    const f: FocusTimerState = { duration: seconds, endsAt: null, remaining: seconds, running: false };
    saveFocus(f);
    set({ focusTimer: f });
  },
  startFocusTimer: () => {
    const cur = get().focusTimer;
    const remaining = cur.remaining > 0 ? cur.remaining : cur.duration;
    const f: FocusTimerState = { ...cur, remaining, endsAt: Date.now() + remaining * 1000, running: true };
    saveFocus(f);
    set({ focusTimer: f });
  },
  pauseFocusTimer: () => {
    const cur = get().focusTimer;
    const remaining = cur.endsAt ? Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000)) : cur.remaining;
    const f: FocusTimerState = { ...cur, remaining, endsAt: null, running: false };
    saveFocus(f);
    set({ focusTimer: f });
  },
  resetFocusTimer: () => {
    const cur = get().focusTimer;
    const f: FocusTimerState = { duration: cur.duration, endsAt: null, remaining: cur.duration, running: false };
    saveFocus(f);
    set({ focusTimer: f });
  },
  completeFocusTimer: async () => {
    const cur = get().focusTimer;
    const minutes = Math.max(1, Math.floor(cur.duration / 60));
    const xp = await get().awardFocusXP(minutes);
    const f: FocusTimerState = { duration: cur.duration, endsAt: null, remaining: 0, running: false };
    saveFocus(f);
    set({ focusTimer: f });
    return xp;
  },

  loadAll: async (userId) => {
    set({ loading: true });
    const today = todayDate();
    const [profileRes, mistakesRes, sessionsRes, taskCompletionsRes, mysteryBoxesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("mistakes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("sessions").select("id,created_at,score,total,duration_seconds,mode,xp_earned").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("task_completions").select("id,task_key,task_label,day_label,completed_on").eq("user_id", userId).eq("completed_on", today),
      supabase.from("mystery_boxes").select("id,level_number,tier,upgrade_clicks_used,reward_label,opened_at,claimed_at,reward_payload,created_at,updated_at").eq("user_id", userId).order("level_number", { ascending: false }),
    ]);

    set({
      profile: normalizeProfile(profileRes.data),
      mistakes: dedupeMistakes(((mistakesRes.data as MistakeRecord[]) ?? [])),
      sessions: (sessionsRes.data as SessionSummary[]) ?? [],
      taskCompletions: (taskCompletionsRes.data as TaskCompletion[]) ?? [],
      mysteryBoxes: (mysteryBoxesRes.data as MysteryBox[]) ?? [],
      loading: false,
    });

    if (profileRes.data) {
      // Streak reset: if last session is older than 1 day, zero out streak
      const lastSessionDate = (sessionsRes.data as SessionSummary[] | null)?.[0]?.created_at?.slice(0, 10);
      const currentStreak = (profileRes.data as any).streak ?? 0;
      if (currentStreak > 0) {
        const todayMs = new Date(`${today}T00:00:00`).getTime();
        const lastMs = lastSessionDate ? new Date(`${lastSessionDate}T00:00:00`).getTime() : null;
        const diffDays = lastMs === null ? Infinity : Math.round((todayMs - lastMs) / 86400000);
        if (diffDays > 1 && !hasLiveBoost((profileRes.data as any).active_boosts ?? [], "streak_freeze")) {
          const { data: zeroed } = await supabase
            .from("profiles").update({ streak: 0 }).eq("id", userId).select().single();
          if (zeroed) set({ profile: normalizeProfile(zeroed) });
        }
      }
      await get().syncBoxes();
      await get().pruneExpiredBoosts();
    }
  },

  updateProfile: async (patch) => {
    const profile = get().profile;
    if (!profile) return;
    const { data } = await supabase.from("profiles").update(patch).eq("id", profile.id).select().single();
    if (data) set({ profile: normalizeProfile(data) });
  },

  markTaskComplete: async ({ taskKey, taskLabel, dayLabel }) => {
    const profile = get().profile;
    if (!profile) return;

    const { data, error } = await supabase
      .from("task_completions")
      .upsert(
        {
          user_id: profile.id,
          task_key: taskKey,
          task_label: taskLabel,
          day_label: dayLabel,
          completed_on: todayDate(),
        },
        { onConflict: "user_id,task_key,completed_on" },
      )
      .select("id,task_key,task_label,day_label,completed_on")
      .single();

    if (!error && data) {
      set((state) => ({
        taskCompletions: Array.from(
          new Map([data as TaskCompletion, ...state.taskCompletions].map((item) => [item.task_key, item])).values(),
        ),
      }));
    }
  },

  syncBoxes: async () => {
    const profile = get().profile;
    if (!profile) return;

    const unlockedLevels = Math.max(1, Math.floor(profile.xp / 500) + 1);
    const existingLevels = new Set(get().mysteryBoxes.map((box) => box.level_number));
    // Always include level 0 as the free starter box
    const allLevels = [0, ...Array.from({ length: unlockedLevels }, (_, index) => index + 1)];
    const missingLevels = allLevels.filter((level) => !existingLevels.has(level));

    if (missingLevels.length > 0) {
      await supabase.from("mystery_boxes").insert(
        missingLevels.map((level) => ({
          user_id: profile.id,
          level_number: level,
          tier: level === 0 ? "rare" as const : "common" as const,
          reward_label: level === 0 ? "Starter Box" : `Level ${level} Mystery Box`,
        })),
      );
    }

    const { data } = await supabase
      .from("mystery_boxes")
      .select("id,level_number,tier,upgrade_clicks_used,reward_label,opened_at,claimed_at,reward_payload,created_at,updated_at")
      .eq("user_id", profile.id)
      .order("level_number", { ascending: false });

    set({ mysteryBoxes: (data as MysteryBox[]) ?? [] });
  },

  upgradeMysteryBox: async (boxId) => {
    const box = get().mysteryBoxes.find((entry) => entry.id === boxId);
    if (!box || box.upgrade_clicks_used >= 3) return null;

    const roll = Math.random();
    let nextTier = box.tier;
    if (box.tier === "common" && roll < 0.3) nextTier = "rare";
    else if (box.tier === "rare" && roll < 0.15) nextTier = "epic";
    else if (box.tier === "epic" && roll < 0.05) nextTier = "legendary";

    const { data, error } = await supabase
      .from("mystery_boxes")
      .update({
        tier: nextTier,
        upgrade_clicks_used: box.upgrade_clicks_used + 1,
      })
      .eq("id", boxId)
      .select("id,level_number,tier,upgrade_clicks_used,reward_label,opened_at,claimed_at,reward_payload,created_at,updated_at")
      .single();

    if (!error && data) {
      set((state) => ({
        mysteryBoxes: state.mysteryBoxes.map((entry) => (entry.id === boxId ? (data as MysteryBox) : entry)),
      }));
      return data as MysteryBox;
    }

    return null;
  },

  openMysteryBox: async (boxId) => {
    const profile = get().profile;
    const box = get().mysteryBoxes.find((entry) => entry.id === boxId);
    if (!profile || !box || box.reward_payload || box.claimed_at) return null;

    const reward = rewardForTier(box.tier);
    const inventoryItem = inventoryFromReward(reward);
    const nextInventory = inventoryItem ? [...profile.inventory, inventoryItem] : profile.inventory;
    const spMultiplier = spMultiplierFromBoosts(profile.active_boosts);
    const patch: any =
      reward.type === "sp"
        ? { sp: profile.sp + reward.amount * spMultiplier }
        : { inventory: nextInventory };

    const [{ data: updatedBox, error }, { data: updatedProfile }] = await Promise.all([
      supabase
        .from("mystery_boxes")
        .update({ reward_payload: reward as any, opened_at: new Date().toISOString(), claimed_at: new Date().toISOString() } as any)
        .eq("id", boxId)
        .select("id,level_number,tier,upgrade_clicks_used,reward_label,opened_at,claimed_at,reward_payload,created_at,updated_at")
        .single(),
      supabase.from("profiles").update(patch).eq("id", profile.id).select().single(),
    ]);

    if (!error && updatedBox) {
      set((state) => ({
        profile: normalizeProfile(updatedProfile) ?? state.profile,
        mysteryBoxes: state.mysteryBoxes.map((entry) => (entry.id === boxId ? (updatedBox as MysteryBox) : entry)),
      }));
      return reward;
    }
    return null;
  },

  buyStoreItem: async (item) => {
    const profile = get().profile;
    if (!profile || profile.sp < item.cost) return false;
    const inventoryItem: InventoryItem = {
      id: uid(),
      kind: item.kind,
      label: item.label,
      minutes: item.minutes,
      acquired_at: new Date().toISOString(),
    };
    const { data } = await supabase
      .from("profiles")
      .update({ sp: profile.sp - item.cost, inventory: [...profile.inventory, inventoryItem] } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      return true;
    }
    return false;
  },

  activateInventoryItem: async (itemId) => {
    const profile = get().profile;
    if (!profile) return false;
    const item = profile.inventory.find((i) => i.id === itemId);
    if (!item) return false;

    // Question-time buffs cannot be pre-activated
    if (isQuestionTimeBoost(item.kind)) return false;

    const liveBoosts = filterLiveBoosts(profile.active_boosts);
    if (liveBoosts.length >= 3) return false;

    let nextActive = liveBoosts;
    if (item.minutes) {
      nextActive = [
        ...liveBoosts,
        {
          id: item.id,
          kind: item.kind,
          label: item.label,
          expires_at: new Date(Date.now() + item.minutes * 60_000).toISOString(),
        },
      ];
    }

    const nextInventory = profile.inventory.filter((i) => i.id !== itemId);

    const { data } = await supabase
      .from("profiles")
      .update({ inventory: nextInventory, active_boosts: nextActive } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      return true;
    }
    return false;
  },

  consumeInventoryItem: async (itemId) => {
    const profile = get().profile;
    if (!profile) return false;
    const item = profile.inventory.find((i) => i.id === itemId);
    if (!item) return false;

    const nextInventory = profile.inventory.filter((i) => i.id !== itemId);

    const { data } = await supabase
      .from("profiles")
      .update({ inventory: nextInventory } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      return true;
    }
    return false;
  },

  pruneExpiredBoosts: async () => {
    const profile = get().profile;
    if (!profile) return;
    const live = filterLiveBoosts(profile.active_boosts);
    if (live.length === profile.active_boosts.length) return;
    const { data } = await supabase
      .from("profiles")
      .update({ active_boosts: live } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) set({ profile: normalizeProfile(data) });
  },

  awardFocusXP: async (minutes) => {
    const profile = get().profile;
    if (!profile) return 0;
    const mult = xpMultiplierFromBoosts(profile.active_boosts);
    const gained = Math.round(minutes * 3 * mult);
    const { data } = await supabase
      .from("profiles")
      .update({
        xp: profile.xp + gained,
        focus_minutes_total: profile.focus_minutes_total + minutes,
      } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      await get().syncBoxes();
    }
    return gained;
  },

  recordMistake: async ({ question, userChoice, timeSpent, reason }) => {
    const profile = get().profile;
    if (!profile) return;

    const existing = get().mistakes.find(
      (mistake) =>
        mistake.user_id === profile.id &&
        mistake.section === question.section &&
        mistake.topic === question.topic &&
        mistake.prompt === question.prompt,
    );
    if (existing) return;

    const { data, error } = await supabase
      .from("mistakes")
      .insert({
        user_id: profile.id,
        section: question.section,
        topic: question.topic,
        difficulty: question.difficulty,
        reason,
        time_spent: timeSpent,
        prompt: question.prompt,
        passage: question.passage ?? null,
        choices: question.choices,
        correct_index: question.correct,
        user_choice: userChoice,
        explanation: question.explanation,
      })
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ mistakes: dedupeMistakes([data as MistakeRecord, ...state.mistakes]) }));
    }
  },

  awardXP: async (difficulty) => {
    const profile = get().profile;
    if (!profile) return 0;

    const baseXP = xpForDifficulty(difficulty);
    const mult = xpMultiplierFromBoosts(profile.active_boosts);
    const gained = baseXP * mult;
    // Optimistic local update — DB sync deferred to recordSession to avoid
    // dozens of round-trips when a drill is graded in bulk.
    set({ profile: { ...profile, xp: profile.xp + gained, streak: Math.max(1, profile.streak || 0) } });
    return gained;
  },

  // Force a full profile re-sync from the database
  syncProfile: async () => {
    const profile = get().profile;
    if (!profile) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (data) set({ profile: normalizeProfile(data) });
  },

  recordSession: async ({ mode, score, total, duration, xpEarned }) => {
    const profile = get().profile;
    if (!profile) return;

    const { data } = await supabase
      .from("sessions")
      .insert({
        user_id: profile.id,
        mode,
        score,
        total,
        duration_seconds: duration,
        xp_earned: xpEarned,
      })
      .select("id,created_at,score,total,duration_seconds,mode,xp_earned")
      .single();

    const today = todayDate();
    const lastSessionDate = get().sessions[0]?.created_at?.slice(0, 10);
    let nextStreak = profile.streak || 0;

    if (lastSessionDate === today) nextStreak = Math.max(1, nextStreak);
    else if (!lastSessionDate) nextStreak = 1;
    else {
      const diffDays = Math.round(
        (new Date(`${today}T00:00:00`).getTime() - new Date(`${lastSessionDate}T00:00:00`).getTime()) / 86400000,
      );
      nextStreak = diffDays === 1 ? nextStreak + 1 : hasLiveBoost(profile.active_boosts, "streak_freeze") ? Math.max(1, nextStreak) : 1;
    }

    const { data: updatedProfile } = await supabase
      .from("profiles")
      .update({ streak: nextStreak, xp: profile.xp, sp: profile.sp + 5 })
      .eq("id", profile.id)
      .select()
      .single();

    set((state) => ({
      sessions: data ? [data as SessionSummary, ...state.sessions] : state.sessions,
      profile: normalizeProfile(updatedProfile) ?? state.profile,
    }));

    // Re-fetch profile from DB to get authoritative XP value and sync boxes
    const { data: freshProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (freshProfile) {
      set({ profile: normalizeProfile(freshProfile) });
      await get().syncBoxes();
    }
  },

  resolveMistake: async (id) => {
    const profile = get().profile;
    if (!profile) return;

    const source = get().mistakes.find((mistake) => mistake.id === id);
    if (!source) return;

    const { error } = await supabase
      .from("mistakes")
      .delete()
      .eq("user_id", profile.id)
      .eq("section", source.section)
      .eq("topic", source.topic)
      .eq("prompt", source.prompt);

    if (!error) {
      set((state) => ({
        mistakes: state.mistakes.filter(
          (mistake) =>
            !(
              mistake.user_id === profile.id &&
              mistake.section === source.section &&
              mistake.topic === source.topic &&
              mistake.prompt === source.prompt
            ),
        ),
      }));
    }
  },

  claimDailySP: async (amount) => {
    const profile = get().profile;
    if (!profile) return false;
    const { data } = await supabase
      .from("profiles")
      .update({ sp: profile.sp + amount })
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      return true;
    }
    return false;
  },

  reset: () =>
    set({
      profile: null,
      mistakes: [],
      sessions: [],
      taskCompletions: [],
      mysteryBoxes: [],
      loading: false,
    }),
}));
