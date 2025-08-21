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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      cron_job_logs: {
        Row: {
          error_message: string | null
          executed_at: string | null
          id: string
          job_name: string
          response_data: Json | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          job_name: string
          response_data?: Json | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          job_name?: string
          response_data?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          country_code: string
          created_at: string
          date: string
          id: string
          is_public: boolean | null
          name: string
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          country_code: string
          created_at?: string
          date: string
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          country_code?: string
          created_at?: string
          date?: string
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      profile_access_log: {
        Row: {
          access_time: string
          access_type: string
          accessed_by: string
          id: string
          ip_address: unknown | null
          profile_user_id: string
          user_agent: string | null
        }
        Insert: {
          access_time?: string
          access_type?: string
          accessed_by: string
          id?: string
          ip_address?: unknown | null
          profile_user_id: string
          user_agent?: string | null
        }
        Update: {
          access_time?: string
          access_type?: string
          accessed_by?: string
          id?: string
          ip_address?: unknown | null
          profile_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country_code: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          requires_password_change: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          requires_password_change?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          requires_password_change?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_entries: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          availability_status: Database["public"]["Enums"]["availability_status"]
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          shift_type: Database["public"]["Enums"]["shift_type"] | null
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          availability_status?: Database["public"]["Enums"]["availability_status"]
          created_at?: string
          created_by: string
          date: string
          id?: string
          notes?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"] | null
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          availability_status?: Database["public"]["Enums"]["availability_status"]
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"] | null
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          is_manager: boolean
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_manager?: boolean
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_manager?: boolean
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
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
      check_temporary_password: {
        Args: { _password: string; _user_id: string }
        Returns: boolean
      }
      create_default_schedule_with_holidays: {
        Args: {
          _country_code?: string
          _created_by: string
          _end_date: string
          _start_date: string
          _team_id: string
          _user_id: string
        }
        Returns: number
      }
      create_team_default_schedules_with_holidays: {
        Args: {
          _created_by: string
          _end_date: string
          _start_date: string
          _team_id: string
        }
        Returns: {
          country_code: string
          shifts_created: number
          user_id: string
        }[]
      }
      get_cron_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      get_managed_team_ids: {
        Args: { _uid: string }
        Returns: string[]
      }
      get_schedule_availability: {
        Args: { _end: string; _start: string }
        Returns: {
          availability_status: Database["public"]["Enums"]["availability_status"]
          date: string
          team_id: string
          user_id: string
        }[]
      }
      get_user_teams: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_holidays_for_year: {
        Args: { _country_code: string; _year: number }
        Returns: undefined
      }
      is_manager_of_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      log_profile_access: {
        Args: { _access_type?: string; _profile_user_id: string }
        Returns: undefined
      }
      trigger_weekly_notifications: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_manager_team_access: {
        Args: { _manager_id: string; _target_user_id: string }
        Returns: boolean
      }
      verify_user_password: {
        Args: { _email: string; _password: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "work"
        | "vacation"
        | "sick"
        | "hotline_support"
        | "out_of_office"
        | "training"
        | "flextime"
        | "working_from_home"
      app_role: "manager" | "planner" | "teammember" | "admin"
      availability_status: "available" | "unavailable"
      shift_type: "early" | "late" | "normal"
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
      activity_type: [
        "work",
        "vacation",
        "sick",
        "hotline_support",
        "out_of_office",
        "training",
        "flextime",
        "working_from_home",
      ],
      app_role: ["manager", "planner", "teammember", "admin"],
      availability_status: ["available", "unavailable"],
      shift_type: ["early", "late", "normal"],
    },
  },
} as const
