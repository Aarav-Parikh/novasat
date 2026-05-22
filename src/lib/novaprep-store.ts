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

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  label: string;
  emoji: string;
  cost: number;
  description: string;
}

export const COSMETIC_CATALOG: CosmeticItem[] = [
  { id: "grad_cap", slot: "hat", label: "Graduation Cap", emoji: "🎓", cost: 120, description: "A tiny mortarboard for the diligent scholar." },
  { id: "beanie", slot: "hat", label: "Study Beanie", emoji: "🧢", cost: 60, description: "Cozy cap for late-night drills." },
  { id: "wizard_hat", slot: "hat", label: "Wizard Hat", emoji: "🪄", cost: 180, description: "Channels mystical SAT energy." },
  { id: "scarf", slot: "neck", label: "Collegiate Scarf", emoji: "🧣", cost: 90, description: "Striped scarf in school colors." },
  { id: "bowtie", slot: "neck", label: "Bowtie", emoji: "🎀", cost: 50, description: "Sharp little bowtie." },
  { id: "medal", slot: "neck", label: "Gold Medal", emoji: "🥇", cost: 200, description: "Worn by champions of the practice grind." },
  { id: "uniform", slot: "outfit", label: "School Uniform", emoji: "👔", cost: 250, description: "Tiny blazer and tie." },
  { id: "hoodie", slot: "outfit", label: "Campus Hoodie", emoji: "🧥", cost: 150, description: "Cozy hoodie for marathon study sessions." },
  { id: "labcoat", slot: "outfit", label: "Lab Coat", emoji: "🥼", cost: 220, description: "For the future PhD." },
];

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
    patch: Partial<Pick<Profile, "display_name" | "target_score" | "test_date">>,
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
  }) => Promise<{ treatsAwarded: number; spAwarded: number } | void>;
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

    const { data, error: sessionError } = await supabase
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
    if (sessionError) throw sessionError;

    const today = todayDate();
    const lastSessionDate = get().sessions[0]?.created_at?.slice(0, 10);
    let nextStreak = profile.streak || 0;

    if (lastSessionDate === today) nextStreak = Math.max(1, nextStreak);
    else if (!lastSessionDate) nextStreak = 1;
    else {
      const diffDays = Math.round(
        (new Date(`${today}T00:00:00`).getTime() -
          new Date(`${lastSessionDate}T00:00:00`).getTime()) /
          86400000,
      );
      nextStreak = diffDays === 1 ? nextStreak + 1 : 1;
    }

    // Pet-driven SP multiplier
    const mood = moodForEnergy(
      computeCurrentEnergy(profile.pet_energy, profile.pet_last_decay_at),
    );
    const spMult = spMultiplierFromPet(mood);
    const spAwarded = Math.round(5 * spMult);

    // Treats: 1 per 5 correct (only when not a review redo)
    const treatsAwarded = mode === "review" ? 0 : treatsFromCorrect(score);

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        streak: nextStreak,
        xp: profile.xp + xpEarned,
        sp: profile.sp + spAwarded,
        treats: profile.treats + treatsAwarded,
      })
      .eq("id", profile.id)
      .select()
      .single();
    if (profileError) throw profileError;

    set((state) => ({
      sessions: data ? [data as SessionSummary, ...state.sessions] : state.sessions,
      profile: normalizeProfile(updatedProfile) ?? state.profile,
    }));

    return { treatsAwarded, spAwarded };
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
    const today = todayDate();
    const taskKey = dailySPTaskKey(today);
    if (get().taskCompletions.some((item) => item.task_key === taskKey && item.completed_on === today)) return false;

    const { data: claimed, error: claimError } = await supabase
      .from("task_completions")
      .insert({
        user_id: profile.id,
        task_key: taskKey,
        task_label: "Daily SP bonus",
        day_label: "Today",
        completed_on: today,
      })
      .select("id,task_key,task_label,day_label,completed_on")
      .single();
    if (claimError || !claimed) return false;

    const { data } = await supabase
      .from("profiles")
      .update({ sp: profile.sp + amount })
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set((state) => ({
        profile: normalizeProfile(data),
        taskCompletions: [claimed as TaskCompletion, ...state.taskCompletions],
      }));
      return true;
    }
    return false;
  },

  // ---------- Pet ----------

  syncPetDecay: async () => {
    const profile = get().profile;
    if (!profile) return;
    const current = computeCurrentEnergy(
      profile.pet_energy,
      profile.pet_last_decay_at,
    );
    // Persist if the displayed energy materially drifted from the stored value
    if (Math.abs(current - profile.pet_energy) >= 1) {
      const { data } = await supabase
        .from("profiles")
        .update({
          pet_energy: Math.round(current),
          pet_last_decay_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select()
        .single();
      if (data) set({ profile: normalizeProfile(data) });
    }
  },

  feedPet: async (treats) => {
    const profile = get().profile;
    if (!profile) return false;
    const n = Math.max(1, Math.floor(treats));
    if (profile.treats < n) return false;
    const current = computeCurrentEnergy(
      profile.pet_energy,
      profile.pet_last_decay_at,
    );
    const nextEnergy = Math.min(100, current + n * 5);
    const { data } = await supabase
      .from("profiles")
      .update({
        treats: profile.treats - n,
        pet_energy: Math.round(nextEnergy),
        pet_last_decay_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      return true;
    }
    return false;
  },

  buyCosmetic: async (cosmeticId) => {
    const profile = get().profile;
    if (!profile) return false;
    const item = COSMETIC_CATALOG.find((c) => c.id === cosmeticId);
    if (!item) return false;
    if (profile.cosmetics.includes(cosmeticId)) return false;
    if (profile.sp < item.cost) return false;
    const { data } = await supabase
      .from("profiles")
      .update({
        sp: profile.sp - item.cost,
        cosmetics: [...profile.cosmetics, cosmeticId],
      } as any)
      .eq("id", profile.id)
      .select()
      .single();
    if (data) {
      set({ profile: normalizeProfile(data) });
      return true;
    }
    return false;
  },

  equipCosmetic: async (slot, cosmeticId) => {
    const profile = get().profile;
    if (!profile) return false;
    if (cosmeticId && !profile.cosmetics.includes(cosmeticId)) return false;
    const nextEquipped: Equipped = { ...profile.equipped };
    if (cosmeticId) nextEquipped[slot] = cosmeticId;
    else delete nextEquipped[slot];
    const { data } = await supabase
      .from("profiles")
      .update({ equipped: nextEquipped } as any)
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
      loading: false,
    }),
}));
