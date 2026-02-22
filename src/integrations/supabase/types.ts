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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      candidates: {
        Row: {
          created_at: string | null
          experience_years: number | null
          goals: string | null
          id: string
          location: string | null
          metadata: Json | null
          name: string
          onboarding_complete: boolean | null
          remote_ok: boolean | null
          salary_max: number | null
          salary_min: number | null
          skills: string[] | null
          title: string | null
          updated_at: string | null
          user_id: string
          vibe: string | null
        }
        Insert: {
          created_at?: string | null
          experience_years?: number | null
          goals?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          name: string
          onboarding_complete?: boolean | null
          remote_ok?: boolean | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          vibe?: string | null
        }
        Update: {
          created_at?: string | null
          experience_years?: number | null
          goals?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          name?: string
          onboarding_complete?: boolean | null
          remote_ok?: boolean | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          vibe?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          is_complete: boolean | null
          summary: string | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_complete?: boolean | null
          summary?: string | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_complete?: boolean | null
          summary?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employers: {
        Row: {
          briefing_complete: boolean | null
          company_name: string
          created_at: string | null
          culture_values: string | null
          id: string
          location: string | null
          metadata: Json | null
          remote_ok: boolean | null
          required_skills: string[] | null
          role_description: string | null
          role_title: string | null
          salary_max: number | null
          salary_min: number | null
          team_size: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          briefing_complete?: boolean | null
          company_name: string
          created_at?: string | null
          culture_values?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          remote_ok?: boolean | null
          required_skills?: string[] | null
          role_description?: string | null
          role_title?: string | null
          salary_max?: number | null
          salary_min?: number | null
          team_size?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          briefing_complete?: boolean | null
          company_name?: string
          created_at?: string | null
          culture_values?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          remote_ok?: boolean | null
          required_skills?: string[] | null
          role_description?: string | null
          role_title?: string | null
          salary_max?: number | null
          salary_min?: number | null
          team_size?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          candidate_id: string
          created_at: string | null
          employer_id: string
          id: string
          match_summary: string | null
          score: number
          status: Database["public"]["Enums"]["match_status"] | null
          tags: string[] | null
          updated_at: string | null
          vibe_match: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          employer_id: string
          id?: string
          match_summary?: string | null
          score: number
          status?: Database["public"]["Enums"]["match_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          vibe_match?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          employer_id?: string
          id?: string
          match_summary?: string | null
          score?: number
          status?: Database["public"]["Enums"]["match_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          vibe_match?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: Database["public"]["Enums"]["message_role"]
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: Database["public"]["Enums"]["message_role"]
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "candidate" | "employer" | "admin"
      conversation_type: "jack" | "jill"
      match_status: "pending" | "approved" | "passed"
      message_role: "system" | "assistant" | "user"
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
      app_role: ["candidate", "employer", "admin"],
      conversation_type: ["jack", "jill"],
      match_status: ["pending", "approved", "passed"],
      message_role: ["system", "assistant", "user"],
    },
  },
} as const
