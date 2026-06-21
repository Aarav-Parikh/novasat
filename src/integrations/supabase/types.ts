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
      profiles: {
        Row: {
          active_boosts: Json
          cosmetics: Json
          created_at: string
          display_name: string | null
          equipped: Json
          focus_minutes_total: number
          id: string
          inventory: Json
          last_login_at: string | null
          login_count: number
          pet_energy: number
          pet_last_decay_at: string
          review_prompt_dismissed: boolean
          sp: number
          streak: number
          target_score: number | null
          test_date: string | null
          treats: number
          tutorial_completed: boolean
          updated_at: string
          xp: number
          xp_boost_until: string | null
        }
        Insert: {
          active_boosts?: Json
          cosmetics?: Json
          created_at?: string
          display_name?: string | null
          equipped?: Json
          focus_minutes_total?: number
          id: string
          inventory?: Json
          last_login_at?: string | null
          login_count?: number
          pet_energy?: number
          pet_last_decay_at?: string
          review_prompt_dismissed?: boolean
          sp?: number
          streak?: number
          target_score?: number | null
          test_date?: string | null
          treats?: number
          tutorial_completed?: boolean
          updated_at?: string
          xp?: number
          xp_boost_until?: string | null
        }
        Update: {
          active_boosts?: Json
          cosmetics?: Json
          created_at?: string
          display_name?: string | null
          equipped?: Json
          focus_minutes_total?: number
          id?: string
          inventory?: Json
          last_login_at?: string | null
          login_count?: number
          pet_energy?: number
          pet_last_decay_at?: string
          review_prompt_dismissed?: boolean
          sp?: number
          streak?: number
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
          created_at: string
          display_name: string
          email: string
          focus_minutes_total: number
          last_login_at: string
          login_count: number
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
      claim_daily_sp: { Args: never; Returns: Json }
      equip_cosmetic: {
        Args: { _cosmetic_id: string; _slot: string }
        Returns: Json
      }
      feed_pet: { Args: { _treats: number }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_review_prompt_dismissed: { Args: never; Returns: undefined }
      mark_tutorial_completed: { Args: never; Returns: undefined }
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
      sync_pet_decay: { Args: never; Returns: Json }
      wake_up_pet: { Args: { _score: number; _total: number }; Returns: Json }
    }
    Enums: {
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
      app_role: ["admin", "user"],
      box_tier: ["common", "rare", "epic", "legendary"],
    },
  },
} as const
