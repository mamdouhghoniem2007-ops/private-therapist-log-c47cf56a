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
      appointments: {
        Row: {
          case_id: string | null
          case_name: string
          case_whatsapp: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          ended_at: string | null
          id: string
          notes: string | null
          scheduled_date: string
          scheduled_time: string
          session_kind: string
          session_type: string | null
          specialist_id: string
          specialist_percentage: number
          started_at: string | null
          status: string
          test_type: string | null
        }
        Insert: {
          case_id?: string | null
          case_name: string
          case_whatsapp?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
          scheduled_time: string
          session_kind?: string
          session_type?: string | null
          specialist_id: string
          specialist_percentage?: number
          started_at?: string | null
          status?: string
          test_type?: string | null
        }
        Update: {
          case_id?: string | null
          case_name?: string
          case_whatsapp?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string
          session_kind?: string
          session_type?: string | null
          specialist_id?: string
          specialist_percentage?: number
          started_at?: string | null
          status?: string
          test_type?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_cost: number
          default_duration_minutes: number
          default_specialist_percentage: number
          id: string
          name: string
          notes: string | null
          recurring_days: number[]
          recurring_time: string
          specialist_id: string
          start_date: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_cost?: number
          default_duration_minutes?: number
          default_specialist_percentage?: number
          id?: string
          name: string
          notes?: string | null
          recurring_days?: number[]
          recurring_time: string
          specialist_id: string
          start_date?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_cost?: number
          default_duration_minutes?: number
          default_specialist_percentage?: number
          id?: string
          name?: string
          notes?: string | null
          recurring_days?: number[]
          recurring_time?: string
          specialist_id?: string
          start_date?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          case_name: string
          cost: number
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          session_date: string
          session_time: string
          session_type: string | null
          specialist_id: string
          specialist_percentage: number
          test_type: string | null
        }
        Insert: {
          case_name: string
          cost: number
          created_at?: string
          duration_minutes: number
          id?: string
          notes?: string | null
          session_date: string
          session_time: string
          session_type?: string | null
          specialist_id: string
          specialist_percentage?: number
          test_type?: string | null
        }
        Update: {
          case_name?: string
          cost?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          session_date?: string
          session_time?: string
          session_type?: string | null
          specialist_id?: string
          specialist_percentage?: number
          test_type?: string | null
        }
        Relationships: []
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
      generate_case_appointments: {
        Args: { _case_id: string; _until: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "specialist" | "supervisor"
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
      app_role: ["admin", "specialist", "supervisor"],
    },
  },
} as const
