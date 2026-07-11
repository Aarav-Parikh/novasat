import {
  Award, CalendarDays, Flame, Medal, ShieldCheck, Star, Target, Trophy, Zap,
  Gem, Clock3, BookOpenCheck, Crown, Backpack, Snowflake, Rocket, Brain, TrendingUp,
} from "lucide-react";

export type BadgeState = {
  sessions: number;
  accuracy: number;
  bestAccuracy: number;
  mistakes: number;
  streak: number;
  xp: number;
  sp: number;
  hours: number;
  level: number;
  targetScore?: number | null;
  testDate?: string | null;
  avgPace: number;
  projected: number;
  inventory: number;
};

export type BadgeDef = {
  key: string;
  name: string;
  icon: any;
  test: (s: BadgeState) => boolean;
  detail: string;
};

export const BADGE_CATALOG: BadgeDef[] = [
  { key: "first_launch", name: "First Launch", icon: ShieldCheck, test: (s) => s.sessions >= 1, detail: "Complete 1 session" },
  { key: "consistency_core", name: "Consistency Core", icon: Flame, test: (s) => s.sessions >= 5, detail: "Complete 5 sessions" },
  { key: "iron_schedule", name: "Iron Schedule", icon: CalendarDays, test: (s) => s.sessions >= 20, detail: "Complete 20 sessions" },
  { key: "marathon_mind", name: "Marathon Mind", icon: Clock3, test: (s) => s.hours >= 5, detail: "Log 5 hours of practice" },
  { key: "endurance_pilot", name: "Endurance Pilot", icon: Rocket, test: (s) => s.hours >= 20, detail: "Log 20 hours of practice" },
  { key: "accuracy_ace", name: "Accuracy Ace", icon: Target, test: (s) => s.accuracy >= 80, detail: "Reach 80% lifetime accuracy" },
  { key: "sharpshooter", name: "Sharpshooter", icon: Target, test: (s) => s.accuracy >= 90, detail: "Reach 90% lifetime accuracy" },
  { key: "perfect_drill", name: "Perfect Drill", icon: Star, test: (s) => s.bestAccuracy === 100, detail: "Score 100% on a session" },
  { key: "pace_breaker", name: "Pace Breaker", icon: Clock3, test: (s) => s.avgPace > 0 && s.avgPace <= 75, detail: "Average 75s per question or faster" },
  { key: "score_climber", name: "Score Climber", icon: TrendingUp, test: (s) => s.projected >= 1300, detail: "Hit a 1300+ projected score" },
  { key: "elite_trajectory", name: "Elite Trajectory", icon: Crown, test: (s) => s.projected >= 1500, detail: "Hit a 1500+ projected score" },
  { key: "hot_streak", name: "Hot Streak", icon: Flame, test: (s) => s.streak >= 3, detail: "Hold a 3-day streak" },
  { key: "wildfire", name: "Wildfire", icon: Flame, test: (s) => s.streak >= 7, detail: "Hold a 7-day streak" },
  { key: "unbroken", name: "Unbroken", icon: Snowflake, test: (s) => s.streak >= 14, detail: "Hold a 14-day streak" },
  { key: "sp_collector", name: "SP Collector", icon: Gem, test: (s) => s.sp >= 50, detail: "Hold 50 SP at once" },
  { key: "sp_tycoon", name: "SP Tycoon", icon: Gem, test: (s) => s.sp >= 250, detail: "Hold 250 SP at once" },
  { key: "quartermaster", name: "Quartermaster", icon: Backpack, test: (s) => s.inventory >= 5, detail: "Stockpile 5 inventory items" },
  { key: "vault_cleaner", name: "Vault Cleaner", icon: BookOpenCheck, test: (s) => s.mistakes === 0 && s.sessions > 0, detail: "Clear all weak areas" },
  { key: "xp_pilot", name: "XP Pilot", icon: Zap, test: (s) => s.xp >= 2500, detail: "Earn 2,500 XP" },
  { key: "xp_veteran", name: "XP Veteran", icon: Brain, test: (s) => s.xp >= 10000, detail: "Earn 10,000 XP" },
  { key: "rank_climber", name: "Rank Climber", icon: Medal, test: (s) => s.level >= 10, detail: "Reach level 10" },
  { key: "commander_track", name: "Commander Track", icon: Crown, test: (s) => s.level >= 30, detail: "Reach level 30" },
  { key: "early_bird", name: "Early Bird", icon: CalendarDays, test: (s) => Boolean(s.testDate), detail: "Set a test date" },
  { key: "goal_setter", name: "Goal Setter", icon: Award, test: (s) => Boolean(s.targetScore), detail: "Set a target score" },
];

export function unlockedBadgeKeys(state: BadgeState): string[] {
  return BADGE_CATALOG.filter((b) => b.test(state)).map((b) => b.key);
}
