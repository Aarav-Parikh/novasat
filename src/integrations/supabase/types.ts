export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          count: number
          updated_at: string
          used_on: string
          user_id: string
        }
        Insert: {
          count?: number
          updated_at?: string
          used_on?: string
          user_id: string
        }
        Update: {
          count?: number
          updated_at?: string
          used_on?: string
          user_id?: string
        }
        Relationships: []
      }
      baseline_scores: {
        Row: {
          created_at: string
          id: string
          math_score: number
          rw_score: number
          taken_on: string
          test_label: string
          test_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          math_score: number
          rw_score: number
          taken_on?: string
          test_label: string
          test_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          math_score?: number
          rw_score?: number
          taken_on?: string
          test_label?: string
          test_type?: string
          user_id?: string
        }
        Relationships: []
      }
      club_members: {
        Row: {
          club_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          owner_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          name: string
          owner_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          owner_id?: string
          slug?: string
        }
        Relationships: []
      }
      duel_answers: {
        Row: {
          correct: boolean
          created_at: string
          duel_id: string
          id: string
          q_index: number
          time_ms: number
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          duel_id: string
          id?: string
          q_index: number
          time_ms?: number
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          duel_id?: string
          id?: string
          q_index?: number
          time_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_answers_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          challenger_correct: number
          challenger_id: string
          challenger_time_ms: number
          created_at: string
          finalized_at: string | null
          id: string
          opponent_correct: number
          opponent_id: string
          opponent_time_ms: number
          questions: Json
          section: string
          started_at: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          challenger_correct?: number
          challenger_id: string
          challenger_time_ms?: number
          created_at?: string
          finalized_at?: string | null
          id?: string
          opponent_correct?: number
          opponent_id: string
          opponent_time_ms?: number
          questions?: Json
          section: string
          started_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          challenger_correct?: number
          challenger_id?: string
          challenger_time_ms?: number
          created_at?: string
          finalized_at?: string | null
          id?: string
          opponent_correct?: number
          opponent_id?: string
          opponent_time_ms?: number
          questions?: Json
          section?: string
          started_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      mistakes: {
        Row: {
          choices: Json
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          passage: string | null
          prompt: string
          reason: string
          section: string
          time_spent: number
          topic: string
          user_choice: number | null
          user_id: string
        }
        Insert: {
          choices: Json
          correct_index: number
          created_at?: string
          difficulty: string
          explanation?: string | null
          id?: string
          passage?: string | null
          prompt: string
          reason: string
          section: string
          time_spent?: number
          topic: string
          user_choice?: number | null
          user_id: string
        }
        Update: {
          choices?: Json
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          passage?: string | null
          prompt?: string
          reason?: string
          section?: string
          time_spent?: number
          topic?: string
          user_choice?: number | null
          user_id?: string
        }
        Relationships: []
      }
      mystery_boxes: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          level_number: number
          opened_at: string | null
          reward_label: string | null
          reward_payload: Json | null
          tier: Database["public"]["Enums"]["box_tier"]
          updated_at: string
          upgrade_clicks_used: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          level_number: number
          opened_at?: string | null
          reward_label?: string | null
          reward_payload?: Json | null
          tier?: Database["public"]["Enums"]["box_tier"]
          updated_at?: string
          upgrade_clicks_used?: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          level_number?: number
          opened_at?: string | null
          reward_label?: string | null
          reward_payload?: Json | null
          tier?: Database["public"]["Enums"]["box_tier"]
          updated_at?: string
          upgrade_clicks_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mystery_boxes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active_boosts: Json
          adaptive_pacing_enabled: boolean
          avatar_url: string | null
          cosmetics: Json
          created_at: string
          display_name: string | null
          equipped: Json
          focus_minutes_total: number
          full_sat_pacing_uses: number
          id: string
          inventory: Json
          last_login_at: string | null
          login_count: number
          pet_energy: number
          pet_last_decay_at: string
          pet_level: number
          pet_xp: number
          review_prompt_dismissed: boolean
          sp: number
          streak: number
          streak_freezes: number
          target_score: number | null
          test_date: string | null
          treats: number
          tutorial_completed: boolean
          updated_at: string
          xp: number
          xp_boost_until: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active_boosts?: Json
          adaptive_pacing_enabled?: boolean
          avatar_url?: string | null
          cosmetics?: Json
          created_at?: string
          display_name?: string | null
          equipped?: Json
          focus_minutes_total?: number
          full_sat_pacing_uses?: number
          id: string
          inventory?: Json
          last_login_at?: string | null
          login_count?: number
          pet_energy?: number
          pet_last_decay_at?: string
          pet_level?: number
          pet_xp?: number
          review_prompt_dismissed?: boolean
          sp?: number
          streak?: number
          streak_freezes?: number
          target_score?: number | null
          test_date?: string | null
          treats?: number
          tutorial_completed?: boolean
          updated_at?: string
          xp?: number
          xp_boost_until?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active_boosts?: Json
          adaptive_pacing_enabled?: boolean
          avatar_url?: string | null
          cosmetics?: Json
          created_at?: string
          display_name?: string | null
          equipped?: Json
          focus_minutes_total?: number
          full_sat_pacing_uses?: number
          id?: string
          inventory?: Json
          last_login_at?: string | null
          login_count?: number
          pet_energy?: number
          pet_last_decay_at?: string
          pet_level?: number
          pet_xp?: number
          review_prompt_dismissed?: boolean
          sp?: number
          streak?: number
          streak_freezes?: number
          target_score?: number | null
          test_date?: string | null
          treats?: number
          tutorial_completed?: boolean
          updated_at?: string
          xp?: number
          xp_boost_until?: string | null
        }
        Relationships: []
      }
      progress_shares: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          revoked_at: string | null
          slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      quest_claims: {
        Row: {
          claimed_at: string
          id: string
          period_key: string
          quest_key: string
          reward_sp: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          period_key: string
          quest_key: string
          reward_sp: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          period_key?: string
          quest_key?: string
          reward_sp?: number
          user_id?: string
        }
        Relationships: []
      }
      question_annotations: {
        Row: {
          created_at: string
          eliminations: Json
          flag_category: string | null
          flag_note: string | null
          id: string
          question_id: string
          question_prompt: string | null
          section: string | null
          session_id: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eliminations?: Json
          flag_category?: string | null
          flag_note?: string | null
          id?: string
          question_id: string
          question_prompt?: string | null
          section?: string | null
          session_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          eliminations?: Json
          flag_category?: string | null
          flag_note?: string | null
          id?: string
          question_id?: string
          question_prompt?: string | null
          section?: string | null
          session_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_annotations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          mode: string
          score: number
          total: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          id?: string
          mode: string
          score: number
          total: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          mode?: string
          score?: number
          total?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_on: string
          created_at: string
          day_label: string
          id: string
          task_key: string
          task_label: string
          user_id: string
        }
        Insert: {
          completed_on?: string
          created_at?: string
          day_label: string
          id?: string
          task_key: string
          task_label: string
          user_id: string
        }
        Update: {
          completed_on?: string
          created_at?: string
          day_label?: string
          id?: string
          task_key?: string
          task_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_all_reviews: {
        Args: never
        Returns: {
          comment: string
          created_at: string
          display_name: string
          id: string
          rating: number
          user_id: string
        }[]
      }
      admin_global_stats: {
        Args: never
        Returns: {
          avg_rating: number
          total_focus_minutes: number
          total_reviews: number
          total_session_seconds: number
          total_sessions: number
          total_users: number
          total_xp: number
        }[]
      }
      admin_user_summary: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          focus_minutes_total: number
          last_login_at: string
          login_count: number
          session_minutes: number
          sessions_count: number
          streak: number
          user_id: string
          xp: number
        }[]
      }
      bump_ai_usage: {
        Args: { _amount?: number; _user_id: string }
        Returns: number
      }
      buy_cosmetic: { Args: { _cosmetic_id: string }; Returns: Json }
      cancel_friend_request: { Args: { _id: string }; Returns: Json }
      claim_daily_sp: { Args: never; Returns: Json }
      claim_quest: { Args: { _quest_key: string }; Returns: Json }
      club_leaderboard: {
        Args: { _club_id: string }
        Returns: {
          display_name: string
          streak: number
          user_id: string
          weekly_xp: number
        }[]
      }
      create_club: { Args: { _name: string }; Returns: Json }
      create_duel: {
        Args: {
          _opponent_display_name: string
          _questions: Json
          _section: string
        }
        Returns: Json
      }
      create_share_link: { Args: never; Returns: Json }
      donate_xp_to_pet: { Args: { _session_xp: number }; Returns: Json }
      equip_cosmetic: {
        Args: { _cosmetic_id: string; _slot: string }
        Returns: Json
      }
      feed_pet: { Args: { _treats: number }; Returns: Json }
      finalize_duel: { Args: { _duel_id: string }; Returns: Json }
      get_public_progress: { Args: { _slug: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_pacing_uses: { Args: never; Returns: number }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      join_club: { Args: { _join_code: string }; Returns: Json }
      leaderboard_top: {
        Args: { _limit?: number; _scope: string }
        Returns: {
          avatar_url: string
          display_name: string
          streak: number
          user_id: string
          weekly_xp: number
        }[]
      }
      list_friends: {
        Args: never
        Returns: {
          avatar_url: string
          direction: string
          display_name: string
          friend_id: string
          friendship_id: string
          status: string
          streak: number
          weekly_xp: number
          xp: number
        }[]
      }
      list_parent_links: {
        Args: never
        Returns: {
          created_at: string
          id: string
          parent_id: string
          parent_name: string
          status: string
          student_email: string
          student_id: string
          student_name: string
        }[]
      }
      list_quests: { Args: never; Returns: Json }
      mark_review_prompt_dismissed: { Args: never; Returns: undefined }
      mark_tutorial_completed: { Args: never; Returns: undefined }
      parent_child_progress: { Args: { _student_id: string }; Returns: Json }
      pet_level_for_xp: { Args: { _xp: number }; Returns: number }
      record_login_and_get_onboarding: { Args: never; Returns: Json }
      record_session_rewards: {
        Args: {
          _duration: number
          _mode: string
          _score: number
          _total: number
          _xp: number
        }
        Returns: Json
      }
      request_parent_link: { Args: { _child_email: string }; Returns: Json }
      respond_friend_request: {
        Args: { _accept: boolean; _id: string }
        Returns: Json
      }
      respond_parent_link: {
        Args: { _accept: boolean; _id: string }
        Returns: Json
      }
      revoke_share_link: { Args: { _id: string }; Returns: Json }
      send_friend_request: { Args: { _display_name: string }; Returns: Json }
      send_friend_request_by_email: { Args: { _email: string }; Returns: Json }
      submit_duel_answer: {
        Args: {
          _correct: boolean
          _duel_id: string
          _q_index: number
          _time_ms: number
        }
        Returns: Json
      }
      suggested_users: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          streak: number
          user_id: string
          xp: number
        }[]
      }
      sync_pet_decay: { Args: never; Returns: Json }
      use_streak_freeze: { Args: never; Returns: Json }
      wake_up_pet: { Args: { _score: number; _total: number }; Returns: Json }
    }
    Enums: {
      account_type: "student" | "parent"
      app_role: "admin" | "user"
      box_tier: "common" | "rare" | "epic" | "legendary"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["student", "parent"],
      app_role: ["admin", "user"],
      box_tier: ["common", "rare", "epic", "legendary"],
    },
  },
} as const
