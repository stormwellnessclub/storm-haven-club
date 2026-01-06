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
      ai_workouts: {
        Row: {
          ai_reasoning: string | null
          completed_at: string | null
          created_at: string | null
          difficulty: string | null
          duration_minutes: number | null
          exercises: Json | null
          generated_at: string | null
          id: string
          is_completed: boolean | null
          member_id: string
          workout_name: string
          workout_type: string
        }
        Insert: {
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          generated_at?: string | null
          id?: string
          is_completed?: boolean | null
          member_id: string
          workout_name: string
          workout_type: string
        }
        Update: {
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          generated_at?: string | null
          id?: string
          is_completed?: boolean | null
          member_id?: string
          workout_name?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          checked_out_at: string | null
          created_at: string | null
          id: string
          member_id: string
          notes: string | null
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          checked_out_at?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          checked_out_at?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      class_bookings: {
        Row: {
          amount_paid: number | null
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          created_at: string
          credits_used: number | null
          id: string
          member_credit_id: string | null
          member_id: string | null
          pass_id: string | null
          payment_method: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string
          credits_used?: number | null
          id?: string
          member_credit_id?: string | null
          member_id?: string | null
          pass_id?: string | null
          payment_method?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string
          credits_used?: number | null
          id?: string
          member_credit_id?: string | null
          member_id?: string | null
          pass_id?: string | null
          payment_method?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_member_credit_id_fkey"
            columns: ["member_credit_id"]
            isOneToOne: false
            referencedRelation: "member_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_credits: {
        Row: {
          created_at: string
          credits_remaining: number
          credits_total: number
          expires_at: string
          id: string
          member_id: string
          month_year: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number
          credits_total?: number
          expires_at: string
          id?: string
          member_id: string
          month_year: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number
          credits_total?: number
          expires_at?: string
          id?: string
          member_id?: string
          month_year?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_credits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_credits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      class_passes: {
        Row: {
          category: Database["public"]["Enums"]["class_category"]
          classes_remaining: number
          classes_total: number
          created_at: string
          expires_at: string
          id: string
          is_member_price: boolean
          member_id: string | null
          pass_type: string
          price_paid: number
          purchased_at: string
          status: Database["public"]["Enums"]["pass_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["class_category"]
          classes_remaining: number
          classes_total: number
          created_at?: string
          expires_at: string
          id?: string
          is_member_price?: boolean
          member_id?: string | null
          pass_type: string
          price_paid: number
          purchased_at?: string
          status?: Database["public"]["Enums"]["pass_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["class_category"]
          classes_remaining?: number
          classes_total?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_member_price?: boolean
          member_id?: string | null
          pass_type?: string
          price_paid?: number
          purchased_at?: string
          status?: Database["public"]["Enums"]["pass_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_passes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_passes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      class_pricing: {
        Row: {
          category: Database["public"]["Enums"]["class_category"]
          created_at: string
          id: string
          is_active: boolean
          member_price: number
          non_member_price: number
          pass_type: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["class_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          member_price: number
          non_member_price: number
          pass_type: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["class_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          member_price?: number
          non_member_price?: number
          pass_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          class_type_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          instructor_id: string | null
          is_active: boolean
          max_capacity: number | null
          room: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          class_type_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_capacity?: number | null
          room?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          class_type_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_capacity?: number | null
          room?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          cancellation_reason: string | null
          class_type_id: string
          created_at: string
          current_enrollment: number
          end_time: string
          id: string
          instructor_id: string | null
          is_cancelled: boolean
          max_capacity: number
          room: string | null
          schedule_id: string | null
          session_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          class_type_id: string
          created_at?: string
          current_enrollment?: number
          end_time: string
          id?: string
          instructor_id?: string | null
          is_cancelled?: boolean
          max_capacity: number
          room?: string | null
          schedule_id?: string | null
          session_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          class_type_id?: string
          created_at?: string
          current_enrollment?: number
          end_time?: string
          id?: string
          instructor_id?: string | null
          is_cancelled?: boolean
          max_capacity?: number
          room?: string | null
          schedule_id?: string | null
          session_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      class_types: {
        Row: {
          category: Database["public"]["Enums"]["class_category"]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          is_heated: boolean
          max_capacity: number
          name: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["class_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_heated?: boolean
          max_capacity?: number
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["class_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_heated?: boolean
          max_capacity?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_waitlist: {
        Row: {
          claim_expires_at: string | null
          claimed_at: string | null
          created_at: string
          id: string
          notified_at: string | null
          position: number
          session_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_expires_at?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          position: number
          session_id: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_expires_at?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          position?: number
          session_id?: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_waitlist_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_type: string
          amount: number
          created_at: string
          credit_type: string
          id: string
          member_credit_id: string | null
          member_id: string
          new_balance: number
          previous_balance: number
          reason: string | null
        }
        Insert: {
          adjusted_by: string
          adjustment_type: string
          amount: number
          created_at?: string
          credit_type: string
          id?: string
          member_credit_id?: string | null
          member_id: string
          new_balance: number
          previous_balance: number
          reason?: string | null
        }
        Update: {
          adjusted_by?: string
          adjustment_type?: string
          amount?: number
          created_at?: string
          credit_type?: string
          id?: string
          member_credit_id?: string | null
          member_id?: string
          new_balance?: number
          previous_balance?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_adjustments_member_credit_id_fkey"
            columns: ["member_credit_id"]
            isOneToOne: false
            referencedRelation: "member_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_adjustments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_adjustments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message_body: string
          resend_message_id: string | null
          sender_email: string
          sender_name: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_body: string
          resend_message_id?: string | null
          sender_email: string
          sender_name?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_body?: string
          resend_message_id?: string | null
          sender_email?: string
          sender_name?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "email_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          technogym_exercise_id: string | null
          technogym_id: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          technogym_exercise_id?: string | null
          technogym_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          technogym_exercise_id?: string | null
          technogym_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      goal_milestones: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          goal_id: string
          id: string
          milestone_label: string
          milestone_value: number
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          goal_id: string
          id?: string
          milestone_label: string
          milestone_value: number
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          goal_id?: string
          id?: string
          milestone_label?: string
          milestone_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "member_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress_logs: {
        Row: {
          created_at: string | null
          goal_id: string
          id: string
          logged_at: string | null
          notes: string | null
          progress_value: number
        }
        Insert: {
          created_at?: string | null
          goal_id: string
          id?: string
          logged_at?: string | null
          notes?: string | null
          progress_value: number
        }
        Update: {
          created_at?: string | null
          goal_id?: string
          id?: string
          logged_at?: string | null
          notes?: string | null
          progress_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_logs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "member_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          count: number | null
          created_at: string | null
          habit_id: string
          id: string
          logged_at: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          habit_id: string
          id?: string
          logged_at?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          habit_id?: string
          id?: string
          logged_at?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          member_id: string
          name: string
          target_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          member_id: string
          name: string
          target_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string
          name?: string
          target_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          bio: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          photo_url: string | null
          specialties: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      manual_charges: {
        Row: {
          amount: number
          application_id: string | null
          charged_by: string
          created_at: string
          description: string
          id: string
          member_id: string | null
          refund_method: string | null
          refund_notes: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          charged_by: string
          created_at?: string
          description: string
          id?: string
          member_id?: string | null
          refund_method?: string | null
          refund_notes?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          charged_by?: string
          created_at?: string
          description?: string
          id?: string
          member_id?: string | null
          refund_method?: string | null
          refund_notes?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_charges_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_charges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_charges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_achievements: {
        Row: {
          achievement_name: string
          achievement_type: string
          created_at: string | null
          description: string | null
          earned_at: string | null
          id: string
          member_id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achievement_name: string
          achievement_type: string
          created_at?: string | null
          description?: string | null
          earned_at?: string | null
          id?: string
          member_id: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achievement_name?: string
          achievement_type?: string
          created_at?: string | null
          description?: string | null
          earned_at?: string | null
          id?: string
          member_id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_credits: {
        Row: {
          created_at: string
          credit_type: Database["public"]["Enums"]["credit_type"]
          credits_remaining: number
          credits_total: number
          cycle_end: string
          cycle_start: string
          expires_at: string
          id: string
          member_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_type: Database["public"]["Enums"]["credit_type"]
          credits_remaining: number
          credits_total: number
          cycle_end: string
          cycle_start: string
          expires_at: string
          id?: string
          member_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_type?: Database["public"]["Enums"]["credit_type"]
          credits_remaining?: number
          credits_total?: number
          cycle_end?: string
          cycle_start?: string
          expires_at?: string
          id?: string
          member_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_credits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_credits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_fitness_profiles: {
        Row: {
          available_equipment: string[] | null
          available_time_minutes: number | null
          created_at: string | null
          equipment_ids: string[] | null
          fitness_level: string | null
          id: string
          injuries_limitations: string[] | null
          member_id: string
          primary_goal: string | null
          secondary_goals: string[] | null
          updated_at: string | null
          user_id: string
          workout_preferences: Json | null
        }
        Insert: {
          available_equipment?: string[] | null
          available_time_minutes?: number | null
          created_at?: string | null
          equipment_ids?: string[] | null
          fitness_level?: string | null
          id?: string
          injuries_limitations?: string[] | null
          member_id: string
          primary_goal?: string | null
          secondary_goals?: string[] | null
          updated_at?: string | null
          user_id: string
          workout_preferences?: Json | null
        }
        Update: {
          available_equipment?: string[] | null
          available_time_minutes?: number | null
          created_at?: string | null
          equipment_ids?: string[] | null
          fitness_level?: string | null
          id?: string
          injuries_limitations?: string[] | null
          member_id?: string
          primary_goal?: string | null
          secondary_goals?: string[] | null
          updated_at?: string | null
          user_id?: string
          workout_preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "member_fitness_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_fitness_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_freezes: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          created_at: string | null
          duration_months: number
          fee_paid: boolean | null
          freeze_fee_total: number
          freeze_year: number
          id: string
          member_id: string
          reason: string | null
          rejection_reason: string | null
          requested_end_date: string
          requested_start_date: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          created_at?: string | null
          duration_months: number
          fee_paid?: boolean | null
          freeze_fee_total?: number
          freeze_year?: number
          id?: string
          member_id: string
          reason?: string | null
          rejection_reason?: string | null
          requested_end_date: string
          requested_start_date: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          created_at?: string | null
          duration_months?: number
          fee_paid?: boolean | null
          freeze_fee_total?: number
          freeze_year?: number
          id?: string
          member_id?: string
          reason?: string | null
          rejection_reason?: string | null
          requested_end_date?: string
          requested_start_date?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_freezes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_freezes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          goal_type: string
          id: string
          member_id: string
          start_date: string | null
          status: string | null
          target_date: string | null
          target_value: number
          unit: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          goal_type: string
          id?: string
          member_id: string
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          target_value: number
          unit?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          goal_type?: string
          id?: string
          member_id?: string
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          target_value?: number
          unit?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_health_scores: {
        Row: {
          calculated_at: string | null
          components: Json | null
          created_at: string | null
          id: string
          member_id: string
          score: number
          user_id: string
        }
        Insert: {
          calculated_at?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          member_id: string
          score: number
          user_id: string
        }
        Update: {
          calculated_at?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          member_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_health_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_health_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          activated_at: string | null
          activation_deadline: string | null
          annual_fee_paid_at: string | null
          annual_fee_subscription_id: string | null
          approved_at: string | null
          billing_type: string | null
          created_at: string | null
          email: string
          first_name: string
          gender: string | null
          id: string
          is_founding_member: boolean | null
          last_name: string
          locked_start_date: string | null
          member_id: string
          membership_end_date: string | null
          membership_start_date: string
          membership_type: string
          phone: string | null
          photo_url: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_deadline?: string | null
          annual_fee_paid_at?: string | null
          annual_fee_subscription_id?: string | null
          approved_at?: string | null
          billing_type?: string | null
          created_at?: string | null
          email: string
          first_name: string
          gender?: string | null
          id?: string
          is_founding_member?: boolean | null
          last_name: string
          locked_start_date?: string | null
          member_id: string
          membership_end_date?: string | null
          membership_start_date?: string
          membership_type?: string
          phone?: string | null
          photo_url?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_deadline?: string | null
          annual_fee_paid_at?: string | null
          annual_fee_subscription_id?: string | null
          approved_at?: string | null
          billing_type?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          gender?: string | null
          id?: string
          is_founding_member?: boolean | null
          last_name?: string
          locked_start_date?: string | null
          member_id?: string
          membership_end_date?: string | null
          membership_start_date?: string
          membership_type?: string
          phone?: string | null
          photo_url?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      membership_applications: {
        Row: {
          address: string
          annual_fee_status: string
          auth_acknowledgment: boolean
          city: string
          country: string
          created_at: string
          credit_card_auth: boolean
          date_of_birth: string
          email: string
          first_name: string
          founding_member: string
          full_name: string
          gender: string
          holistic_wellness: string | null
          id: string
          last_name: string
          lifestyle_integration: string | null
          membership_plan: string
          motivations: string[] | null
          notes: string | null
          one_year_commitment: boolean
          other_goals: string | null
          other_motivation: string | null
          other_services: string | null
          payment_info_provided: boolean
          phone: string
          previous_member: string | null
          referred_by_member: string
          services_interested: string[]
          state: string
          status: string
          stripe_customer_id: string | null
          submission_confirmation: boolean
          updated_at: string
          wellness_goals: string[]
          zip_code: string
        }
        Insert: {
          address: string
          annual_fee_status?: string
          auth_acknowledgment?: boolean
          city: string
          country?: string
          created_at?: string
          credit_card_auth?: boolean
          date_of_birth: string
          email: string
          first_name: string
          founding_member: string
          full_name: string
          gender: string
          holistic_wellness?: string | null
          id?: string
          last_name: string
          lifestyle_integration?: string | null
          membership_plan: string
          motivations?: string[] | null
          notes?: string | null
          one_year_commitment?: boolean
          other_goals?: string | null
          other_motivation?: string | null
          other_services?: string | null
          payment_info_provided?: boolean
          phone: string
          previous_member?: string | null
          referred_by_member: string
          services_interested?: string[]
          state: string
          status?: string
          stripe_customer_id?: string | null
          submission_confirmation?: boolean
          updated_at?: string
          wellness_goals?: string[]
          zip_code: string
        }
        Update: {
          address?: string
          annual_fee_status?: string
          auth_acknowledgment?: boolean
          city?: string
          country?: string
          created_at?: string
          credit_card_auth?: boolean
          date_of_birth?: string
          email?: string
          first_name?: string
          founding_member?: string
          full_name?: string
          gender?: string
          holistic_wellness?: string | null
          id?: string
          last_name?: string
          lifestyle_integration?: string | null
          membership_plan?: string
          motivations?: string[] | null
          notes?: string | null
          one_year_commitment?: boolean
          other_goals?: string | null
          other_motivation?: string | null
          other_services?: string | null
          payment_info_provided?: boolean
          phone?: string
          previous_member?: string | null
          referred_by_member?: string
          services_interested?: string[]
          state?: string
          status?: string
          stripe_customer_id?: string | null
          submission_confirmation?: boolean
          updated_at?: string
          wellness_goals?: string[]
          zip_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          fitness_goals: string | null
          guest_pass_agreement_signed: boolean | null
          id: string
          last_name: string
          membership_agreement_signed: boolean
          membership_agreement_signed_at: string | null
          phone: string | null
          single_class_pass_agreement_signed: boolean | null
          state: string | null
          updated_at: string
          user_id: string
          waiver_signed: boolean
          waiver_signed_at: string | null
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          fitness_goals?: string | null
          guest_pass_agreement_signed?: boolean | null
          id?: string
          last_name: string
          membership_agreement_signed?: boolean
          membership_agreement_signed_at?: string | null
          phone?: string | null
          single_class_pass_agreement_signed?: boolean | null
          state?: string | null
          updated_at?: string
          user_id: string
          waiver_signed?: boolean
          waiver_signed_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          fitness_goals?: string | null
          guest_pass_agreement_signed?: boolean | null
          id?: string
          last_name?: string
          membership_agreement_signed?: boolean
          membership_agreement_signed_at?: string | null
          phone?: string | null
          single_class_pass_agreement_signed?: boolean | null
          state?: string | null
          updated_at?: string
          user_id?: string
          waiver_signed?: boolean
          waiver_signed_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          calories_burned: number | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          logged_at: string | null
          member_id: string
          notes: string | null
          user_id: string
          workout_type: string
        }
        Insert: {
          calories_burned?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          logged_at?: string | null
          member_id: string
          notes?: string | null
          user_id: string
          workout_type: string
        }
        Update: {
          calories_burned?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          logged_at?: string | null
          member_id?: string
          notes?: string | null
          user_id?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booking_check_in_view: {
        Row: {
          booked_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          created_at: string | null
          id: string | null
          member_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booked_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          id?: string | null
          member_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booked_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          id?: string | null
          member_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_public_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          photo_url: string | null
          specialties: string[] | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      member_check_in_view: {
        Row: {
          first_name: string | null
          id: string | null
          last_name: string | null
          member_id: string | null
          membership_type: string | null
          photo_url: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          member_id?: string | null
          membership_type?: string | null
          photo_url?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          member_id?: string | null
          membership_type?: string | null
          photo_url?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_link_member_to_user: {
        Args: { _member_id: string; _user_email: string }
        Returns: boolean
      }
      calculate_health_score: { Args: { _member_id: string }; Returns: number }
      check_and_award_achievements: {
        Args: { _member_id: string }
        Returns: undefined
      }
      check_goal_milestones: { Args: { _goal_id: string }; Returns: undefined }
      create_atomic_class_booking: {
        Args: {
          _member_credit_id?: string
          _pass_id?: string
          _payment_method: string
          _session_id: string
          _user_id: string
        }
        Returns: Json
      }
      current_user_email: { Args: never; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      link_member_by_email: {
        Args: never
        Returns: {
          activated_at: string
          activation_deadline: string
          annual_fee_paid_at: string
          approved_at: string
          email: string
          first_name: string
          gender: string
          id: string
          is_founding_member: boolean
          last_name: string
          locked_start_date: string
          member_id: string
          membership_type: string
          status: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "front_desk"
        | "spa_staff"
        | "class_instructor"
        | "cafe_staff"
        | "childcare_staff"
      booking_status: "confirmed" | "cancelled" | "no_show" | "completed"
      class_category:
        | "pilates_cycling"
        | "other"
        | "reformer"
        | "cycling"
        | "aerobics"
      conversation_status: "open" | "in_progress" | "resolved" | "closed"
      credit_type: "class" | "red_light" | "dry_cryo"
      message_sender_type: "member" | "staff"
      pass_status: "active" | "expired" | "exhausted"
      waitlist_status:
        | "waiting"
        | "notified"
        | "claimed"
        | "expired"
        | "cancelled"
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
      app_role: [
        "super_admin",
        "admin",
        "manager",
        "front_desk",
        "spa_staff",
        "class_instructor",
        "cafe_staff",
        "childcare_staff",
      ],
      booking_status: ["confirmed", "cancelled", "no_show", "completed"],
      class_category: [
        "pilates_cycling",
        "other",
        "reformer",
        "cycling",
        "aerobics",
      ],
      conversation_status: ["open", "in_progress", "resolved", "closed"],
      credit_type: ["class", "red_light", "dry_cryo"],
      message_sender_type: ["member", "staff"],
      pass_status: ["active", "expired", "exhausted"],
      waitlist_status: [
        "waiting",
        "notified",
        "claimed",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
