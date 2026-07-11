import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import {
  MistakeRecord,
  Question,
  Difficulty,
  ErrorReason,
  xpForDifficulty,
} from "./novaprep-data";

// ---------- Pet system ----------

export type PetMood = "energetic" | "tired" | "asleep";
export type CosmeticSlot = "hat" | "neck" | "outfit";

export interface CosmeticBuff {
  xpPct?: number;   // +XP at session end (e.g. 0.10 = +10%)
  spPct?: number;   // +SP at session end
  treatsFlat?: number; // bonus treats per non-review session (when score > 0)
}

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  label: string;
  emoji: string;
  cost: number;
  description: string;
  buff?: CosmeticBuff;
}

export const COSMETIC_CATALOG: CosmeticItem[] = [
  // Hats
  { id: "grad_cap", slot: "hat", label: "Graduation Cap", emoji: "🎓", cost: 120, description: "A tiny mortarboard for the diligent scholar.", buff: { xpPct: 0.10 } },
  { id: "beanie", slot: "hat", label: "Study Beanie", emoji: "🧢", cost: 60, description: "Cozy cap for late-night drills.", buff: { xpPct: 0.05 } },
  { id: "wizard_hat", slot: "hat", label: "Wizard Hat", emoji: "🪄", cost: 180, description: "Channels mystical SAT energy.", buff: { xpPct: 0.15 } },
  { id: "crown", slot: "hat", label: "Royal Crown", emoji: "👑", cost: 300, description: "For the king of the curve.", buff: { spPct: 0.20 } },
  { id: "cowboy_hat", slot: "hat", label: "Cowboy Hat", emoji: "🤠", cost: 140, description: "Yeehaw, partner.", buff: { treatsFlat: 1 } },
  { id: "party_hat", slot: "hat", label: "Party Hat", emoji: "🥳", cost: 80, description: "Every drill is a party.", buff: { spPct: 0.10 } },
  { id: "top_hat", slot: "hat", label: "Top Hat", emoji: "🎩", cost: 200, description: "Dapper as can be.", buff: { spPct: 0.10 } },
  // Neck
  { id: "scarf", slot: "neck", label: "Collegiate Scarf", emoji: "🧣", cost: 90, description: "Striped scarf in school colors.", buff: { xpPct: 0.05 } },
  { id: "bowtie", slot: "neck", label: "Bowtie", emoji: "🎀", cost: 50, description: "Sharp little bowtie.", buff: { spPct: 0.05 } },
  { id: "medal", slot: "neck", label: "Gold Medal", emoji: "🥇", cost: 200, description: "Worn by champions of the practice grind.", buff: { spPct: 0.15 } },
  { id: "bandana", slot: "neck", label: "Bandana", emoji: "🪢", cost: 70, description: "Adventure-ready.", buff: { xpPct: 0.05 } },
  { id: "necktie", slot: "neck", label: "Necktie", emoji: "👔", cost: 110, description: "All business.", buff: { xpPct: 0.10 } },
  { id: "gold_chain", slot: "neck", label: "Gold Chain", emoji: "📿", cost: 260, description: "Drip on point.", buff: { spPct: 0.20 } },
  // Outfit
  { id: "uniform", slot: "outfit", label: "School Uniform", emoji: "👔", cost: 250, description: "Tiny blazer and tie.", buff: { xpPct: 0.15 } },
  { id: "hoodie", slot: "outfit", label: "Campus Hoodie", emoji: "🧥", cost: 150, description: "Cozy hoodie for marathon study sessions.", buff: { xpPct: 0.10, spPct: 0.05 } },
  { id: "labcoat", slot: "outfit", label: "Lab Coat", emoji: "🥼", cost: 220, description: "For the future PhD.", buff: { xpPct: 0.20 } },
  { id: "superhero_cape", slot: "outfit", label: "Superhero Cape", emoji: "🦸", cost: 280, description: "SAT-saving powers.", buff: { xpPct: 0.25 } },
  { id: "tuxedo", slot: "outfit", label: "Tuxedo", emoji: "🤵", cost: 320, description: "Formal event ready.", buff: { spPct: 0.25 } },
  { id: "varsity_jacket", slot: "outfit", label: "Varsity Jacket", emoji: "🧥", cost: 200, description: "Team captain energy.", buff: { xpPct: 0.15, spPct: 0.10 } },
  { id: "pajamas", slot: "outfit", label: "Pajamas", emoji: "🛌", cost: 130, description: "Comfy study attire.", buff: { treatsFlat: 2 } },
];

export const formatBuff = (buff?: CosmeticBuff): string[] => {
  if (!buff) return [];
  const parts: string[] = [];
  if (buff.xpPct) parts.push(`+${Math.round(buff.xpPct * 100)}% XP`);
  if (buff.spPct) parts.push(`+${Math.round(buff.spPct * 100)}% SP`);
  if (buff.treatsFlat) parts.push(`+${buff.treatsFlat} treat${buff.treatsFlat > 1 ? "s" : ""}/session`);
  return parts;
};

export const moodForEnergy = (energy: number): PetMood => {
  if (energy >= 75) return "energetic";
  if (energy >= 25) return "tired";
  return "asleep";
};

// 25% drop per 24 hours = proportional decay per ms
const DECAY_PER_MS = 25 / (24 * 60 * 60 * 1000);

export const computeCurrentEnergy = (
  storedEnergy: number,
  lastDecayAt: string,
): number => {
  const elapsedMs = Math.max(0, Date.now() - new Date(lastDecayAt).getTime());
  const decayed = storedEnergy - elapsedMs * DECAY_PER_MS;
  return Math.max(0, Math.min(100, decayed));
};

export const spMultiplierFromPet = (mood: PetMood) =>
  mood === "energetic" ? 1.2 : 1;

export const treatsFromCorrect = (correct: number) =>
  Math.floor(Math.max(0, correct) / 5);

// Pet leveling: cumulative XP needed to reach level L = round(100 * L^1.6).
export const petXpNeededForLevel = (level: number) => Math.round(100 * Math.pow(Math.max(1, level), 1.6));
export const petLevelProgress = (petXp: number, petLevel: number) => {
  const prevCap = petLevel <= 1 ? 0 : petXpNeededForLevel(petLevel - 1);
  const nextCap = petXpNeededForLevel(petLevel);
  const into = Math.max(0, petXp - prevCap);
  const span = Math.max(1, nextCap - prevCap);
  return { into, span, pct: Math.min(100, Math.round((into / span) * 100)), nextCap };
};

// Buffs granted by pet level when Buddy is Energetic (energy >= 75).
export const petLevelBuffs = (level: number) => {
  const buffs: string[] = [];
  if (level >= 3) buffs.push("+5% XP");
  if (level >= 5) buffs.push("+5% SP");
  if (level >= 8) buffs.push("+1 treat / session");
  if (level >= 12) buffs.push("+10% XP");
  if (level >= 20) buffs.push("+15% XP · +10% SP");
  return buffs;
};

// ---------- Profile / data shapes ----------

export interface Equipped {
  hat?: string;
  neck?: string;
  outfit?: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  target_score: number | null;
  test_date: string | null;
  xp: number;
  streak: number;
  sp: number;
  focus_minutes_total: number;
  pet_energy: number;
  pet_last_decay_at: string;
  treats: number;
  cosmetics: string[];
  equipped: Equipped;
  adaptive_pacing_enabled: boolean;
  full_sat_pacing_uses: number;
  pet_xp: number;
  pet_level: number;
  account_type: "student" | "parent";
}

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

const DAILY_SP_KEY_PREFIX = "daily-sp::";

const sessionDate = (createdAt?: string) => createdAt?.slice(0, 10);
const dailySPTaskKey = (date = todayDate()) => `${DAILY_SP_KEY_PREFIX}${date}`;

export interface FocusTimerState {
  duration: number;
  endsAt: number | null;
  remaining: number;
  running: boolean;
}

interface NovaState {
  profile: Profile | null;
  mistakes: MistakeRecord[];
  sessions: SessionSummary[];
  taskCompletions: TaskCompletion[];
  loading: boolean;
  focusTimer: FocusTimerState;
  setFocusDuration: (seconds: number) => void;
  startFocusTimer: () => void;
  pauseFocusTimer: () => void;
  resetFocusTimer: () => void;
  completeFocusTimer: () => Promise<number>;
  loadAll: (userId: string) => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<Profile, "display_name" | "target_score" | "test_date" | "adaptive_pacing_enabled">>,
  ) => Promise<void>;
  markTaskComplete: (task: {
    taskKey: string;
    taskLabel: string;
    dayLabel: string;
  }) => Promise<void>;
  awardFocusXP: (minutes: number) => Promise<number>;
  recordMistake: (m: {
    question: Question;
    userChoice: number | null;
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
  }) => Promise<{ treatsAwarded: number; spAwarded: number; sessionId: string | null } | void>;
  resolveMistake: (id: string) => Promise<void>;
  claimDailySP: (amount: number) => Promise<boolean>;
  // Pet
  syncPetDecay: () => Promise<void>;
  feedPet: (treats: number) => Promise<boolean>;
  buyCosmetic: (cosmeticId: string) => Promise<boolean>;
  equipCosmetic: (slot: CosmeticSlot, cosmeticId: string | null) => Promise<boolean>;
  reset: () => void;
}

const todayDate = () => new Date().toISOString().slice(0, 10);

const dedupeMistakes = (mistakes: MistakeRecord[]) =>
  Array.from(
    new Map(
      mistakes.map((m) => [`${m.section}::${m.topic}::${m.prompt}`, m]),
    ).values(),
  );

const normalizeProfile = (raw: any): Profile | null => {
  if (!raw) return null;
  return {
    id: raw.id,
    display_name: raw.display_name ?? null,
    target_score: raw.target_score ?? null,
    test_date: raw.test_date ?? null,
    xp: raw.xp ?? 0,
    streak: raw.streak ?? 0,
    sp: raw.sp ?? 0,
    focus_minutes_total: raw.focus_minutes_total ?? 0,
    pet_energy: typeof raw.pet_energy === "number" ? raw.pet_energy : 100,
    pet_last_decay_at: raw.pet_last_decay_at ?? new Date().toISOString(),
    treats: raw.treats ?? 0,
    cosmetics: Array.isArray(raw.cosmetics) ? (raw.cosmetics as string[]) : [],
    equipped:
      raw.equipped && typeof raw.equipped === "object"
        ? (raw.equipped as Equipped)
        : {},
    adaptive_pacing_enabled: raw.adaptive_pacing_enabled !== false,
    full_sat_pacing_uses: typeof raw.full_sat_pacing_uses === "number" ? raw.full_sat_pacing_uses : 0,
    pet_xp: typeof raw.pet_xp === "number" ? raw.pet_xp : 0,
    pet_level: typeof raw.pet_level === "number" ? raw.pet_level : 1,
  };
};

const FOCUS_KEY = "novaprep:focus-timer";
const loadFocus = (): FocusTimerState => {
  if (typeof window === "undefined")
    return { duration: 25 * 60, endsAt: null, remaining: 25 * 60, running: false };
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
  try {
    window.localStorage.setItem(FOCUS_KEY, JSON.stringify(f));
  } catch {}
};

export const useNova = create<NovaState>((set, get) => ({
  profile: null,
  mistakes: [],
  sessions: [],
  taskCompletions: [],
  loading: false,
  focusTimer: loadFocus(),

  setFocusDuration: (seconds) => {
    const f: FocusTimerState = {
      duration: seconds,
      endsAt: null,
      remaining: seconds,
      running: false,
    };
    saveFocus(f);
    set({ focusTimer: f });
  },
  startFocusTimer: () => {
    const cur = get().focusTimer;
    const remaining = cur.remaining > 0 ? cur.remaining : cur.duration;
    const f: FocusTimerState = {
      ...cur,
      remaining,
      endsAt: Date.now() + remaining * 1000,
      running: true,
    };
    saveFocus(f);
    set({ focusTimer: f });
  },
  pauseFocusTimer: () => {
    const cur = get().focusTimer;
    const remaining = cur.endsAt
      ? Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000))
      : cur.remaining;
    const f: FocusTimerState = { ...cur, remaining, endsAt: null, running: false };
    saveFocus(f);
    set({ focusTimer: f });
  },
  resetFocusTimer: () => {
    const cur = get().focusTimer;
    const f: FocusTimerState = {
      duration: cur.duration,
      endsAt: null,
      remaining: cur.duration,
      running: false,
    };
    saveFocus(f);
    set({ focusTimer: f });
  },
  completeFocusTimer: async () => {
    const cur = get().focusTimer;
    const minutes = Math.max(1, Math.floor(cur.duration / 60));
    const xp = await get().awardFocusXP(minutes);
    const f: FocusTimerState = {
      duration: cur.duration,
      endsAt: null,
      remaining: 0,
      running: false,
    };
    saveFocus(f);
    set({ focusTimer: f });
    return xp;
  },

  loadAll: async (userId) => {
    set({ loading: true });
    const today = todayDate();
    const [profileRes, mistakesRes, sessionsRes, taskCompletionsRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("mistakes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("sessions")
          .select("id,created_at,score,total,duration_seconds,mode,xp_earned")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("task_completions")
          .select("id,task_key,task_label,day_label,completed_on")
          .eq("user_id", userId)
          .eq("completed_on", today),
      ]);

    let profileData = profileRes.data;
    if (!profileData) {
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select("*")
        .maybeSingle();
      profileData = created ?? null;
      if (!profileData) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        profileData = existing ?? null;
      }
    }

    set({
      profile: normalizeProfile(profileData),
      mistakes: dedupeMistakes(((mistakesRes.data as MistakeRecord[]) ?? [])),
      sessions: (sessionsRes.data as SessionSummary[]) ?? [],
      taskCompletions: (taskCompletionsRes.data as TaskCompletion[]) ?? [],
      loading: false,
    });

    if (profileData) {
      // Streak reset
      const lastSessionDate = (sessionsRes.data as SessionSummary[] | null)?.[0]
        ?.created_at?.slice(0, 10);
      const currentStreak = (profileData as any).streak ?? 0;
      if (currentStreak > 0) {
        const todayMs = new Date(`${today}T00:00:00`).getTime();
        const lastMs = lastSessionDate
          ? new Date(`${lastSessionDate}T00:00:00`).getTime()
          : null;
        const diffDays =
          lastMs === null ? Infinity : Math.round((todayMs - lastMs) / 86400000);
        if (diffDays > 1) {
          const { data: zeroed } = await supabase
            .from("profiles")
            .update({ streak: 0 })
            .eq("id", userId)
            .select()
            .single();
          if (zeroed) set({ profile: normalizeProfile(zeroed) });
        }
      }
      await get().syncPetDecay();
    }
  },

  updateProfile: async (patch) => {
    const profile = get().profile;
    if (!profile) return;
    const { data } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", profile.id)
      .select()
      .single();
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
          new Map(
            [data as TaskCompletion, ...state.taskCompletions].map((item) => [
              item.task_key,
              item,
            ]),
          ).values(),
        ),
      }));
    }
  },

  

  awardFocusXP: async (minutes) => {
    const profile = get().profile;
    if (!profile) return 0;
    const gained = Math.round(minutes * 3);
    const { data } = await supabase
      .from("profiles")
      .update({
        xp: profile.xp + gained,
        focus_minutes_total: profile.focus_minutes_total + minutes,
      } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) set({ profile: normalizeProfile(data) });
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
      set((state) => ({
        mistakes: dedupeMistakes([data as MistakeRecord, ...state.mistakes]),
      }));
    }
  },

  awardXP: async (difficulty) => {
    const profile = get().profile;
    if (!profile) return 0;

    const gained = xpForDifficulty(difficulty);
    set({
      profile: {
        ...profile,
        xp: profile.xp + gained,
        streak: Math.max(1, profile.streak || 0),
      },
    });
    return gained;
  },

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

    const { data: result, error } = await supabase.rpc("record_session_rewards", {
      _mode: mode,
      _score: score,
      _total: total,
      _duration: duration,
      _xp: xpEarned,
    });
    if (error) throw error;

    const payload = (result ?? {}) as {
      session_id?: string;
      xp_awarded?: number;
      sp_awarded?: number;
      treats_awarded?: number;
      streak?: number;
    };
    const spAwarded = payload.sp_awarded ?? 0;
    const treatsAwarded = payload.treats_awarded ?? 0;

    const [{ data: freshProfile }, sessionRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle(),
      payload.session_id
        ? supabase
            .from("sessions")
            .select("id,created_at,score,total,duration_seconds,mode,xp_earned")
            .eq("id", payload.session_id)
            .maybeSingle()
        : Promise.resolve({ data: null as SessionSummary | null }),
    ]);
    const freshSession = (sessionRes as { data: SessionSummary | null }).data;

    set((state) => ({
      sessions: freshSession ? [freshSession, ...state.sessions] : state.sessions,
      profile: freshProfile ? normalizeProfile(freshProfile) ?? state.profile : state.profile,
    }));

    return { treatsAwarded, spAwarded, sessionId: payload.session_id ?? null };
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

  claimDailySP: async (_amount) => {
    const profile = get().profile;
    if (!profile) return false;

    const { data, error } = await supabase.rpc("claim_daily_sp");
    if (error) return false;
    const result = (data ?? {}) as { claimed?: boolean };
    if (!result.claimed) return false;

    const [{ data: freshProfile }, { data: freshTasks }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle(),
      supabase
        .from("task_completions")
        .select("id,task_key,task_label,day_label,completed_on")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);

    set((state) => ({
      profile: freshProfile ? normalizeProfile(freshProfile) ?? state.profile : state.profile,
      taskCompletions: (freshTasks as TaskCompletion[] | null) ?? state.taskCompletions,
    }));
    return true;
  },

  // ---------- Pet ----------

  syncPetDecay: async () => {
    const profile = get().profile;
    if (!profile) return;
    const current = computeCurrentEnergy(
      profile.pet_energy,
      profile.pet_last_decay_at,
    );
    if (Math.abs(current - profile.pet_energy) < 1) return;

    const { error } = await supabase.rpc("sync_pet_decay");
    if (error) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (data) set({ profile: normalizeProfile(data) });
  },

  feedPet: async (treats) => {
    const profile = get().profile;
    if (!profile) return false;
    const n = Math.max(1, Math.floor(treats));

    const { data, error } = await supabase.rpc("feed_pet", { _treats: n });
    if (error) return false;
    const result = (data ?? {}) as { ok?: boolean };
    if (!result.ok) return false;

    const { data: fresh } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (fresh) set({ profile: normalizeProfile(fresh) });
    return true;
  },

  buyCosmetic: async (cosmeticId) => {
    const profile = get().profile;
    if (!profile) return false;

    const { data, error } = await supabase.rpc("buy_cosmetic", { _cosmetic_id: cosmeticId });
    if (error) return false;
    const result = (data ?? {}) as { ok?: boolean };
    if (!result.ok) return false;

    const { data: fresh } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (fresh) set({ profile: normalizeProfile(fresh) });
    return true;
  },

  equipCosmetic: async (slot, cosmeticId) => {
    const profile = get().profile;
    if (!profile) return false;

    const { data, error } = await supabase.rpc("equip_cosmetic", {
      _slot: slot,
      _cosmetic_id: cosmeticId ?? "",
    });
    if (error) return false;
    const result = (data ?? {}) as { ok?: boolean };
    if (!result.ok) return false;

    const { data: fresh } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (fresh) set({ profile: normalizeProfile(fresh) });
    return true;
  },

  reset: () =>
    set({
      profile: null,
      mistakes: [],
      sessions: [],
      taskCompletions: [],
      loading: false,
    }),
}));
