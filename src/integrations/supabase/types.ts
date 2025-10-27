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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics_snapshots: {
        Row: {
          created_at: string
          id: string
          metric_data: Json
          metric_type: string
          snapshot_date: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_data: Json
          metric_type: string
          snapshot_date: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_data?: Json
          metric_type?: string
          snapshot_date?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
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
      dashboard_preferences: {
        Row: {
          coverage_threshold: number | null
          created_at: string
          default_date_range: string | null
          default_team_id: string | null
          fairness_weight: number | null
          favorite_metrics: string[] | null
          id: string
          show_holidays_default: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_threshold?: number | null
          created_at?: string
          default_date_range?: string | null
          default_team_id?: string | null
          fairness_weight?: number | null
          favorite_metrics?: string[] | null
          id?: string
          show_holidays_default?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_threshold?: number | null
          created_at?: string
          default_date_range?: string | null
          default_team_id?: string | null
          fairness_weight?: number | null
          favorite_metrics?: string[] | null
          id?: string
          show_holidays_default?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_preferences_default_team_id_fkey"
            columns: ["default_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_audit_log: {
        Row: {
          action: string
          created_at: string
          delegation_id: string
          details: Json | null
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          delegation_id: string
          details?: Json | null
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          delegation_id?: string
          details?: Json | null
          id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_audit_log_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "manager_delegations"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_assignments: {
        Row: {
          created_at: string
          created_by: string
          date: string
          duty_type: Database["public"]["Enums"]["duty_type"]
          id: string
          notes: string | null
          substitute_user_id: string | null
          team_id: string
          updated_at: string
          user_id: string
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          duty_type: Database["public"]["Enums"]["duty_type"]
          id?: string
          notes?: string | null
          substitute_user_id?: string | null
          team_id: string
          updated_at?: string
          user_id: string
          week_number: number
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          duty_type?: Database["public"]["Enums"]["duty_type"]
          id?: string
          notes?: string | null
          substitute_user_id?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "duty_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_import_status: {
        Row: {
          completed_at: string | null
          country_code: string
          created_by: string | null
          error_message: string | null
          id: string
          imported_count: number | null
          region_code: string | null
          started_at: string
          status: string
          updated_at: string | null
          year: number
        }
        Insert: {
          completed_at?: string | null
          country_code: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          imported_count?: number | null
          region_code?: string | null
          started_at?: string
          status?: string
          updated_at?: string | null
          year: number
        }
        Update: {
          completed_at?: string | null
          country_code?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          imported_count?: number | null
          region_code?: string | null
          started_at?: string
          status?: string
          updated_at?: string | null
          year?: number
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
          region_code: string | null
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
          region_code?: string | null
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
          region_code?: string | null
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      manager_delegations: {
        Row: {
          created_at: string
          delegate_id: string
          end_date: string
          id: string
          manager_id: string
          revoked_at: string | null
          revoked_by: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delegate_id: string
          end_date: string
          id?: string
          manager_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delegate_id?: string
          end_date?: string
          id?: string
          manager_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_access_log: {
        Row: {
          access_time: string
          access_type: string
          accessed_by: string
          id: string
          ip_address: unknown
          profile_user_id: string
          user_agent: string | null
        }
        Insert: {
          access_time?: string
          access_type?: string
          accessed_by: string
          id?: string
          ip_address?: unknown
          profile_user_id: string
          user_agent?: string | null
        }
        Update: {
          access_time?: string
          access_type?: string
          accessed_by?: string
          id?: string
          ip_address?: unknown
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
          initials: string | null
          last_name: string
          region_code: string | null
          requires_password_change: boolean | null
          theme_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          initials?: string | null
          last_name: string
          region_code?: string | null
          requires_password_change?: boolean | null
          theme_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          initials?: string | null
          last_name?: string
          region_code?: string | null
          requires_password_change?: boolean | null
          theme_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_bookmarks: {
        Row: {
          bookmark_type: string
          config: Json
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bookmark_type: string
          config: Json
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bookmark_type?: string
          config?: Json
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      schedule_change_log: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string
          id: string
          new_values: Json | null
          old_values: Json | null
          schedule_entry_id: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          schedule_entry_id?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          schedule_entry_id?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_change_log_schedule_entry_id_fkey"
            columns: ["schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      search_history: {
        Row: {
          id: string
          result_count: number | null
          search_query: string
          search_type: string
          searched_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          result_count?: number | null
          search_query: string
          search_type: string
          searched_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          result_count?: number | null
          search_query?: string
          search_type?: string
          searched_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shift_time_definitions: {
        Row: {
          created_at: string
          created_by: string
          day_of_week: number[] | null
          description: string | null
          end_time: string
          id: string
          region_code: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          start_time: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_week?: number[] | null
          description?: string | null
          end_time: string
          id?: string
          region_code?: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          start_time: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_week?: number[] | null
          description?: string | null
          end_time?: string
          id?: string
          region_code?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          start_time?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_time_definitions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_audit_log: {
        Row: {
          action: string
          changed_by: string
          changes: Json | null
          created_at: string
          id: string
          team_id: string
        }
        Insert: {
          action: string
          changed_by: string
          changes?: Json | null
          created_at?: string
          id?: string
          team_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          changes?: Json | null
          created_at?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_capacity_config: {
        Row: {
          applies_to_weekends: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          max_staff_allowed: number | null
          min_staff_required: number
          notes: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          applies_to_weekends?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_staff_allowed?: number | null
          min_staff_required?: number
          notes?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          applies_to_weekends?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_staff_allowed?: number | null
          min_staff_required?: number
          notes?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_capacity_config_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          team_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          team_ids: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          team_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      team_holiday_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          exclude_from_coverage: boolean | null
          id: string
          include_weekends_in_coverage: boolean | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          exclude_from_coverage?: boolean | null
          id?: string
          include_weekends_in_coverage?: boolean | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          exclude_from_coverage?: boolean | null
          id?: string
          include_weekends_in_coverage?: boolean | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_holiday_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
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
          {
            foreignKeyName: "team_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      team_view_favorites: {
        Row: {
          created_at: string
          id: string
          name: string
          team_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          team_ids: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string | null
          favorite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          favorite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          favorite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
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
      vacation_requests: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          created_at: string
          end_time: string | null
          id: string
          is_full_day: boolean
          notes: string | null
          rejected_at: string | null
          rejection_reason: string | null
          request_group_id: string | null
          requested_date: string
          selected_planner_id: string | null
          start_time: string | null
          status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean
          notes?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          request_group_id?: string | null
          requested_date: string
          selected_planner_id?: string | null
          start_time?: string | null
          status?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean
          notes?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          request_group_id?: string | null
          requested_date?: string
          selected_planner_id?: string | null
          start_time?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_duty_templates: {
        Row: {
          created_at: string
          created_by: string
          distribution_list: string[]
          id: string
          include_earlyshift: boolean
          include_lateshift: boolean
          include_weekend_duty: boolean
          team_ids: string[]
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          distribution_list?: string[]
          id?: string
          include_earlyshift?: boolean
          include_lateshift?: boolean
          include_weekend_duty?: boolean
          team_ids: string[]
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          distribution_list?: string[]
          id?: string
          include_earlyshift?: boolean
          include_lateshift?: boolean
          include_weekend_duty?: boolean
          team_ids?: string[]
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_email_history: {
        Row: {
          id: string
          recipient_count: number
          sent_at: string
          sent_by: string
          status: string
          template_id: string
          week_number: number
          year: number
        }
        Insert: {
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by: string
          status?: string
          template_id: string
          week_number: number
          year: number
        }
        Update: {
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string
          status?: string
          template_id?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_email_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "weekly_duty_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analyze_vacation_patterns: {
        Args: { _lookback_months?: number; _team_id: string }
        Returns: Json
      }
      can_view_sensitive_profile_data: {
        Args: { _profile_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      check_and_expire_delegations: { Args: never; Returns: undefined }
      check_vacation_overlap: {
        Args: {
          _end_time?: string
          _exclude_request_id?: string
          _is_full_day?: boolean
          _requested_date: string
          _start_time?: string
          _user_id: string
        }
        Returns: boolean
      }
      create_default_schedule_with_holidays: {
        Args: {
          _country_code?: string
          _created_by: string
          _end_date: string
          _region_code?: string
          _start_date: string
          _team_id: string
          _user_id: string
        }
        Returns: number
      }
      create_default_schedule_with_holidays_v2: {
        Args: {
          _country_code: string
          _created_by: string
          _end_date: string
          _region_code?: string
          _start_date: string
          _team_id: string
          _user_id: string
        }
        Returns: number
      }
      create_manager_delegation: {
        Args: {
          _delegate_id: string
          _end_date: string
          _manager_id: string
          _start_date: string
        }
        Returns: Json
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
      expire_old_delegations: { Args: never; Returns: undefined }
      get_all_basic_profiles: {
        Args: never
        Returns: {
          email: string
          first_name: string
          initials: string
          last_name: string
          user_id: string
        }[]
      }
      get_all_subteam_ids: { Args: { _team_id: string }; Returns: string[] }
      get_basic_profile_info: {
        Args: { _user_id: string }
        Returns: {
          email: string
          first_name: string
          initials: string
          last_name: string
          user_id: string
        }[]
      }
      get_cron_status: {
        Args: never
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      get_delegated_manager_teams: {
        Args: { _delegate_id: string }
        Returns: string[]
      }
      get_eligible_delegation_users: {
        Args: { _requesting_user_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          roles: string[]
          user_id: string
        }[]
      }
      get_managed_team_ids: { Args: { _uid: string }; Returns: string[] }
      get_manager_accessible_teams: {
        Args: { _manager_id: string }
        Returns: string[]
      }
      get_multiple_basic_profile_info: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          first_name: string
          initials: string
          last_name: string
          user_id: string
        }[]
      }
      get_planners_for_user_team: {
        Args: { _user_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          user_id: string
        }[]
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
      get_scheduling_efficiency: {
        Args: { _end_date: string; _start_date: string; _team_ids: string[] }
        Returns: Json
      }
      get_team_capacity_metrics: {
        Args: { _end_date: string; _start_date: string; _team_id: string }
        Returns: Json
      }
      get_team_hierarchy: {
        Args: { _team_id: string }
        Returns: {
          level: number
          path: string
          team_id: string
          team_name: string
        }[]
      }
      get_team_members_safe: {
        Args: { _team_id: string }
        Returns: {
          country_code: string
          email: string
          first_name: string
          initials: string
          last_name: string
          region_code: string
          user_id: string
        }[]
      }
      get_top_level_approver_for_team: {
        Args: { _team_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          team_name: string
          user_id: string
        }[]
      }
      get_user_shift_counts: {
        Args: {
          _end_date?: string
          _start_date?: string
          _team_ids?: string[]
          _user_ids: string[]
        }
        Returns: {
          holiday_shifts_count: number
          night_shifts_count: number
          total_shifts_count: number
          user_id: string
          weekend_shifts_count: number
        }[]
      }
      get_user_teams: { Args: { _user_id: string }; Returns: string[] }
      global_search: {
        Args: {
          _current_user_id: string
          _limit?: number
          _search_query: string
        }
        Returns: Json
      }
      has_manager_access: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      identify_coverage_gaps: {
        Args: {
          _end_date: string
          _min_coverage?: number
          _start_date: string
          _team_id: string
        }
        Returns: Json
      }
      import_holidays_for_year: {
        Args: { _country_code: string; _year: number }
        Returns: undefined
      }
      is_active_delegate: {
        Args: { _delegate_id: string; _manager_id: string }
        Returns: boolean
      }
      is_in_same_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_of_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      log_profile_access: {
        Args: { _access_type?: string; _profile_user_id: string }
        Returns: undefined
      }
      manager_can_see_full_details: {
        Args: { _manager_id: string; _target_user_id: string }
        Returns: boolean
      }
      mark_pending_imports_complete: {
        Args: never
        Returns: {
          country_code: string
          holiday_count: number
          updated_status: string
        }[]
      }
      mask_email: { Args: { email: string }; Returns: string }
      revoke_manager_delegation: {
        Args: { _delegation_id: string; _revoked_by: string }
        Returns: Json
      }
      trigger_weekly_notifications: { Args: never; Returns: Json }
      validate_manager_team_access: {
        Args: { _manager_id: string; _target_user_id: string }
        Returns: boolean
      }
      verify_temporary_password: {
        Args: { _password: string; _user_id: string }
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
        | "other"
        | "hotline_support"
        | "out_of_office"
        | "training"
        | "flextime"
        | "working_from_home"
      app_role: "manager" | "planner" | "teammember" | "admin"
      availability_status: "available" | "unavailable"
      duty_type: "weekend" | "lateshift" | "earlyshift"
      shift_type: "early" | "late" | "normal" | "weekend"
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
        "other",
        "hotline_support",
        "out_of_office",
        "training",
        "flextime",
        "working_from_home",
      ],
      app_role: ["manager", "planner", "teammember", "admin"],
      availability_status: ["available", "unavailable"],
      duty_type: ["weekend", "lateshift", "earlyshift"],
      shift_type: ["early", "late", "normal", "weekend"],
    },
  },
} as const
