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
      achievements: {
        Row: {
          created_at: string | null
          criteria: Json | null
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          name: string
          points_reward: number | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          points_reward?: number | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          points_reward?: number | null
        }
        Relationships: []
      }
      admin_action_log: {
        Row: {
          action_data: Json
          action_type: string
          can_undo: boolean
          created_at: string
          id: string
          member_id: string | null
          performed_by: string | null
          undo_expires_at: string | null
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          action_data?: Json
          action_type: string
          can_undo?: boolean
          created_at?: string
          id?: string
          member_id?: string | null
          performed_by?: string | null
          undo_expires_at?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          action_data?: Json
          action_type?: string
          can_undo?: boolean
          created_at?: string
          id?: string
          member_id?: string | null
          performed_by?: string | null
          undo_expires_at?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_action_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_action_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_action_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          agreement_type: string
          created_at: string
          description: string | null
          display_order: number | null
          effective_date: string | null
          id: string
          is_active: boolean
          is_required: boolean
          pdf_url: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          agreement_type: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          effective_date?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          pdf_url?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          agreement_type?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          effective_date?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          pdf_url?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
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
            referencedRelation: "member_limited_view"
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
      amenity_usage_logs: {
        Row: {
          amenity_type: Database["public"]["Enums"]["amenity_type"]
          check_in_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          member_id: string
          notes: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          amenity_type: Database["public"]["Enums"]["amenity_type"]
          check_in_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          member_id: string
          notes?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          amenity_type?: Database["public"]["Enums"]["amenity_type"]
          check_in_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          member_id?: string
          notes?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_usage_logs_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_usage_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_usage_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_usage_logs_member_id_fkey"
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
      blocked_persons: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          email: string
          full_name: string | null
          id: string
          member_id: string | null
          notes: string | null
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          email: string
          full_name?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_persons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_persons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_persons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_menu_addons: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menu_addons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cafe_menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_menu_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          has_addons: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          section: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          has_addons?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          section?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          has_addons?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          section?: string
        }
        Relationships: []
      }
      cafe_menu_items: {
        Row: {
          brand_name: string | null
          calories: number | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          dietary_tags: string[] | null
          display_order: number | null
          flavor: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_seasonal: boolean
          item_name: string | null
          price: number
          protein_flavor: string | null
          seasonal_label: string | null
          size: string | null
          stock_quantity: number | null
        }
        Insert: {
          brand_name?: string | null
          calories?: number | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          display_order?: number | null
          flavor?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_seasonal?: boolean
          item_name?: string | null
          price: number
          protein_flavor?: string | null
          seasonal_label?: string | null
          size?: string | null
          stock_quantity?: number | null
        }
        Update: {
          brand_name?: string | null
          calories?: number | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          display_order?: number | null
          flavor?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_seasonal?: boolean
          item_name?: string | null
          price?: number
          protein_flavor?: string | null
          seasonal_label?: string | null
          size?: string | null
          stock_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cafe_menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          estimated_ready_at: string | null
          id: string
          member_id: string | null
          order_items: Json
          payment_intent_id: string | null
          payment_method: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          estimated_ready_at?: string | null
          id?: string
          member_id?: string | null
          order_items: Json
          payment_intent_id?: string | null
          payment_method?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          estimated_ready_at?: string | null
          id?: string
          member_id?: string | null
          order_items?: Json
          payment_intent_id?: string | null
          payment_method?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      card_setup_attempts: {
        Row: {
          application_id: string | null
          card_brand: string | null
          card_last4: string | null
          completed_at: string | null
          created_at: string | null
          decline_code: string | null
          decline_message: string | null
          id: string
          initiated_by: string | null
          member_id: string | null
          metadata: Json | null
          reminder_count: number | null
          reminder_sent_at: string | null
          source: string
          status: string
          stripe_customer_id: string
          stripe_setup_intent: string | null
        }
        Insert: {
          application_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          completed_at?: string | null
          created_at?: string | null
          decline_code?: string | null
          decline_message?: string | null
          id?: string
          initiated_by?: string | null
          member_id?: string | null
          metadata?: Json | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          source: string
          status?: string
          stripe_customer_id: string
          stripe_setup_intent?: string | null
        }
        Update: {
          application_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          completed_at?: string | null
          created_at?: string | null
          decline_code?: string | null
          decline_message?: string | null
          id?: string
          initiated_by?: string | null
          member_id?: string | null
          metadata?: Json | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          source?: string
          status?: string
          stripe_customer_id?: string
          stripe_setup_intent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_setup_attempts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_setup_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_setup_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_setup_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      card_sync_failures: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          member_id: string | null
          resolved_at: string | null
          retry_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_sync_failures_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_sync_failures_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_sync_failures_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
            referencedRelation: "member_limited_view"
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
          user_id: string | null
          walk_in_name: string | null
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
          user_id?: string | null
          walk_in_name?: string | null
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
          user_id?: string | null
          walk_in_name?: string | null
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
            referencedRelation: "member_limited_view"
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
            referencedRelation: "member_limited_view"
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
            referencedRelation: "member_limited_view"
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
      class_reviews: {
        Row: {
          booking_id: string
          class_type_id: string
          created_at: string
          id: string
          is_visible: boolean
          rating: number
          review_text: string | null
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          class_type_id: string
          created_at?: string
          id?: string
          is_visible?: boolean
          rating: number
          review_text?: string | null
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          class_type_id?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          rating?: number
          review_text?: string | null
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "class_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reviews_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "class_schedules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "public_instructors_view"
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
          is_hidden: boolean
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
          is_hidden?: boolean
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
          is_hidden?: boolean
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
            foreignKeyName: "class_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "public_instructors_view"
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
            referencedRelation: "member_limited_view"
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
      email_audit_log: {
        Row: {
          application_id: string | null
          created_at: string | null
          custom_content: string | null
          email_type: string
          error_message: string | null
          id: string
          member_id: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_data: Json | null
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          custom_content?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          member_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_data?: Json | null
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          custom_content?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          member_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_data?: Json | null
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          id: string
          recipient_name: string | null
          recipient_type: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          id?: string
          recipient_name?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          id?: string
          recipient_name?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_filter: Json | null
          body_html: string
          campaign_name: string
          campaign_type: string
          created_at: string
          created_by: string | null
          goal_metadata: Json | null
          goal_type: string | null
          id: string
          sent_at: string | null
          sent_count: number | null
          subject: string
          template_id: string | null
        }
        Insert: {
          audience_filter?: Json | null
          body_html: string
          campaign_name: string
          campaign_type: string
          created_at?: string
          created_by?: string | null
          goal_metadata?: Json | null
          goal_type?: string | null
          id?: string
          sent_at?: string | null
          sent_count?: number | null
          subject: string
          template_id?: string | null
        }
        Update: {
          audience_filter?: Json | null
          body_html?: string
          campaign_name?: string
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          goal_metadata?: Json | null
          goal_type?: string | null
          id?: string
          sent_at?: string | null
          sent_count?: number | null
          subject?: string
          template_id?: string | null
        }
        Relationships: []
      }
      email_conversations: {
        Row: {
          category: string
          created_at: string
          id: string
          last_message_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
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
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean | null
          merge_fields: string[] | null
          name: string
          subject: string
        }
        Insert: {
          body_html: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          merge_fields?: string[] | null
          name: string
          subject: string
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          merge_fields?: string[] | null
          name?: string
          subject?: string
        }
        Relationships: []
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
      guest_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_token: string
          guest_email: string | null
          guest_name: string | null
          guest_pass_id: string | null
          id: string
          rating: number
          submitted_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_token: string
          guest_email?: string | null
          guest_name?: string | null
          guest_pass_id?: string | null
          id?: string
          rating: number
          submitted_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_token?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_pass_id?: string | null
          id?: string
          rating?: number
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_guest_pass_id_fkey"
            columns: ["guest_pass_id"]
            isOneToOne: false
            referencedRelation: "guest_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_passes: {
        Row: {
          add_ons: Json | null
          admin_notes: string | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          checked_in_by: string | null
          created_at: string | null
          expires_at: string | null
          feedback_email_sent_at: string | null
          follow_up_notes: string | null
          follow_up_status: string | null
          guest_email: string | null
          guest_gender: string | null
          guest_name: string
          id: string
          member_referral: string | null
          no_show: boolean | null
          phone_number: string | null
          price_paid: number
          purchased_at: string | null
          referring_member_id: string | null
          sold_by: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          used_at: string | null
          user_id: string | null
          valid_date: string | null
          visit_interests: string[] | null
          visit_notes: string | null
        }
        Insert: {
          add_ons?: Json | null
          admin_notes?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          feedback_email_sent_at?: string | null
          follow_up_notes?: string | null
          follow_up_status?: string | null
          guest_email?: string | null
          guest_gender?: string | null
          guest_name: string
          id?: string
          member_referral?: string | null
          no_show?: boolean | null
          phone_number?: string | null
          price_paid?: number
          purchased_at?: string | null
          referring_member_id?: string | null
          sold_by?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          used_at?: string | null
          user_id?: string | null
          valid_date?: string | null
          visit_interests?: string[] | null
          visit_notes?: string | null
        }
        Update: {
          add_ons?: Json | null
          admin_notes?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          feedback_email_sent_at?: string | null
          follow_up_notes?: string | null
          follow_up_status?: string | null
          guest_email?: string | null
          guest_gender?: string | null
          guest_name?: string
          id?: string
          member_referral?: string | null
          no_show?: boolean | null
          phone_number?: string | null
          price_paid?: number
          purchased_at?: string | null
          referring_member_id?: string | null
          sold_by?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          used_at?: string | null
          user_id?: string | null
          valid_date?: string | null
          visit_interests?: string[] | null
          visit_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_passes_referring_member_id_fkey"
            columns: ["referring_member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_passes_referring_member_id_fkey"
            columns: ["referring_member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_passes_referring_member_id_fkey"
            columns: ["referring_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_services: {
        Row: {
          amount: number
          charged_by: string | null
          created_at: string
          guest_email: string | null
          guest_name: string
          guest_pass_id: string | null
          id: string
          notes: string | null
          service_category: string
          service_date: string
          service_name: string
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          charged_by?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name: string
          guest_pass_id?: string | null
          id?: string
          notes?: string | null
          service_category?: string
          service_date?: string
          service_name: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          charged_by?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string
          guest_pass_id?: string | null
          id?: string
          notes?: string | null
          service_category?: string
          service_date?: string
          service_name?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_services_guest_pass_id_fkey"
            columns: ["guest_pass_id"]
            isOneToOne: false
            referencedRelation: "guest_passes"
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
      habit_streaks: {
        Row: {
          current_streak: number | null
          habit_id: string
          id: string
          last_logged_date: string | null
          longest_streak: number | null
          member_id: string
          updated_at: string | null
        }
        Insert: {
          current_streak?: number | null
          habit_id: string
          id?: string
          last_logged_date?: string | null
          longest_streak?: number | null
          member_id: string
          updated_at?: string | null
        }
        Update: {
          current_streak?: number | null
          habit_id?: string
          id?: string
          last_logged_date?: string | null
          longest_streak?: number | null
          member_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_streaks_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_streaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_streaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_streaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
            referencedRelation: "member_limited_view"
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
      kids_care_bookings: {
        Row: {
          age_group: string | null
          booking_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          child_age: number
          child_dob: string | null
          child_name: string
          created_at: string
          end_time: string
          id: string
          member_id: string
          parent_confirmed_at: string | null
          parent_confirmed_pickup: boolean
          parent_notes: string | null
          pass_id: string | null
          room: string | null
          special_instructions: string | null
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          booking_date: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          child_age: number
          child_dob?: string | null
          child_name: string
          created_at?: string
          end_time: string
          id?: string
          member_id: string
          parent_confirmed_at?: string | null
          parent_confirmed_pickup?: boolean
          parent_notes?: string | null
          pass_id?: string | null
          room?: string | null
          special_instructions?: string | null
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group?: string | null
          booking_date?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          child_age?: number
          child_dob?: string | null
          child_name?: string
          created_at?: string
          end_time?: string
          id?: string
          member_id?: string
          parent_confirmed_at?: string | null
          parent_confirmed_pickup?: boolean
          parent_notes?: string | null
          pass_id?: string | null
          room?: string | null
          special_instructions?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_care_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_care_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_care_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_care_bookings_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "class_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_care_children: {
        Row: {
          allergies: string | null
          authorized_pickup_persons: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          is_active: boolean
          medical_conditions: string | null
          medications: string | null
          photo_release: boolean
          relationship_to_child: string | null
          special_instructions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          authorized_pickup_persons?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          medical_conditions?: string | null
          medications?: string | null
          photo_release?: boolean
          relationship_to_child?: string | null
          special_instructions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string | null
          authorized_pickup_persons?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          medical_conditions?: string | null
          medications?: string | null
          photo_release?: boolean
          relationship_to_child?: string | null
          special_instructions?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_care_hour_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          preferred_days: string[]
          preferred_end_time: string | null
          preferred_start_time: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          preferred_days?: string[]
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          preferred_days?: string[]
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_care_hour_slots: {
        Row: {
          close_time: string
          created_at: string | null
          created_by: string | null
          id: string
          label: string | null
          notes: string | null
          open_time: string
          slot_date: string
          staff_name: string | null
          updated_at: string | null
        }
        Insert: {
          close_time: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          open_time: string
          slot_date: string
          staff_name?: string | null
          updated_at?: string | null
        }
        Update: {
          close_time?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          open_time?: string
          slot_date?: string
          staff_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kids_care_hours: {
        Row: {
          close_time: string
          created_at: string
          created_by: string | null
          day_of_week: number
          id: string
          is_closed: boolean
          notes: string | null
          open_time: string
          updated_at: string
          week_start: string
        }
        Insert: {
          close_time: string
          created_at?: string
          created_by?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean
          notes?: string | null
          open_time: string
          updated_at?: string
          week_start: string
        }
        Update: {
          close_time?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean
          notes?: string | null
          open_time?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      kids_care_interest_waitlist: {
        Row: {
          children_ages: string | null
          children_count: number | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          children_ages?: string | null
          children_count?: number | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          children_ages?: string | null
          children_count?: number | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
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
            referencedRelation: "member_limited_view"
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
      marketing_contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          linked_member_id: string | null
          opted_in_email: boolean | null
          opted_in_sms: boolean | null
          phone: string | null
          segment_tags: string[] | null
          source: Database["public"]["Enums"]["marketing_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_member_id?: string | null
          opted_in_email?: boolean | null
          opted_in_sms?: boolean | null
          phone?: string | null
          segment_tags?: string[] | null
          source?: Database["public"]["Enums"]["marketing_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_member_id?: string | null
          opted_in_email?: boolean | null
          opted_in_sms?: boolean | null
          phone?: string | null
          segment_tags?: string[] | null
          source?: Database["public"]["Enums"]["marketing_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_contacts_linked_member_id_fkey"
            columns: ["linked_member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contacts_linked_member_id_fkey"
            columns: ["linked_member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contacts_linked_member_id_fkey"
            columns: ["linked_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sequence_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          current_step: number
          enrolled_at: string
          id: string
          next_step_at: string | null
          sequence_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_step_at?: string | null
          sequence_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_step_at?: string | null
          sequence_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sequences: {
        Row: {
          channel: Database["public"]["Enums"]["sequence_channel"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          steps: Json
          trigger_type: Database["public"]["Enums"]["sequence_trigger"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["sequence_channel"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          steps?: Json
          trigger_type: Database["public"]["Enums"]["sequence_trigger"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["sequence_channel"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          steps?: Json
          trigger_type?: Database["public"]["Enums"]["sequence_trigger"]
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "member_limited_view"
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
      member_activities: {
        Row: {
          activity_data: Json
          activity_type: string
          created_at: string
          id: string
          member_id: string
          points_earned: number
        }
        Insert: {
          activity_data?: Json
          activity_type: string
          created_at?: string
          id?: string
          member_id: string
          points_earned?: number
        }
        Update: {
          activity_data?: Json
          activity_type?: string
          created_at?: string
          id?: string
          member_id?: string
          points_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_activities_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_activities_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_activities_member_id_fkey"
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
          member_id: string | null
          updated_at: string
          user_id: string | null
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
          member_id?: string | null
          updated_at?: string
          user_id?: string | null
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
          member_id?: string | null
          updated_at?: string
          user_id?: string | null
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
            referencedRelation: "member_limited_view"
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
            referencedRelation: "member_limited_view"
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
            referencedRelation: "member_limited_view"
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
            referencedRelation: "member_limited_view"
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
            referencedRelation: "member_limited_view"
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
      member_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_internal: boolean
          member_id: string
          note_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_internal?: boolean
          member_id: string
          note_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_internal?: boolean
          member_id?: string
          note_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_perk_deliveries: {
        Row: {
          created_at: string | null
          id: string
          member_id: string | null
          notes: string | null
          perk_type: string
          perk_variant: string | null
          size: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          perk_type: string
          perk_variant?: string | null
          size?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          perk_type?: string
          perk_variant?: string | null
          size?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_perk_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_perk_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_perk_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_referrals: {
        Row: {
          created_at: string
          id: string
          points_awarded: number
          points_awarded_at: string | null
          referred_email: string
          referred_first_name: string | null
          referred_last_name: string | null
          referred_member_id: string | null
          referring_member_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number
          points_awarded_at?: string | null
          referred_email: string
          referred_first_name?: string | null
          referred_last_name?: string | null
          referred_member_id?: string | null
          referring_member_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number
          points_awarded_at?: string | null
          referred_email?: string
          referred_first_name?: string | null
          referred_last_name?: string | null
          referred_member_id?: string | null
          referring_member_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_referrals_referred_member_id_fkey"
            columns: ["referred_member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_referrals_referred_member_id_fkey"
            columns: ["referred_member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_referrals_referred_member_id_fkey"
            columns: ["referred_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_referrals_referring_member_id_fkey"
            columns: ["referring_member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_referrals_referring_member_id_fkey"
            columns: ["referring_member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_referrals_referring_member_id_fkey"
            columns: ["referring_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_id: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_tags_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_tags_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_tags_member_id_fkey"
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
          activation_email_sent_at: string | null
          annual_fee_paid_at: string | null
          annual_fee_subscription_id: string | null
          approved_at: string | null
          billing_type: string | null
          cancellation_email_sent_at: string | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          email: string
          first_name: string
          founding_bag_size: string | null
          founding_perks_delivered_at: string | null
          founding_privileges_granted: boolean | null
          founding_privileges_granted_at: string | null
          founding_sweater_size: string | null
          gender: string | null
          id: string
          is_founding_member: boolean | null
          last_name: string
          locked_start_date: string | null
          member_id: string
          membership_end_date: string | null
          membership_start_date: string
          membership_type: string
          original_tier_at_application: string | null
          phone: string | null
          photo_url: string | null
          referral_points_balance: number
          referred_by_code: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier_change_used: boolean | null
          tier_change_used_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_deadline?: string | null
          activation_email_sent_at?: string | null
          annual_fee_paid_at?: string | null
          annual_fee_subscription_id?: string | null
          approved_at?: string | null
          billing_type?: string | null
          cancellation_email_sent_at?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          email: string
          first_name: string
          founding_bag_size?: string | null
          founding_perks_delivered_at?: string | null
          founding_privileges_granted?: boolean | null
          founding_privileges_granted_at?: string | null
          founding_sweater_size?: string | null
          gender?: string | null
          id?: string
          is_founding_member?: boolean | null
          last_name: string
          locked_start_date?: string | null
          member_id: string
          membership_end_date?: string | null
          membership_start_date?: string
          membership_type?: string
          original_tier_at_application?: string | null
          phone?: string | null
          photo_url?: string | null
          referral_points_balance?: number
          referred_by_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier_change_used?: boolean | null
          tier_change_used_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_deadline?: string | null
          activation_email_sent_at?: string | null
          annual_fee_paid_at?: string | null
          annual_fee_subscription_id?: string | null
          approved_at?: string | null
          billing_type?: string | null
          cancellation_email_sent_at?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          founding_bag_size?: string | null
          founding_perks_delivered_at?: string | null
          founding_privileges_granted?: boolean | null
          founding_privileges_granted_at?: string | null
          founding_sweater_size?: string | null
          gender?: string | null
          id?: string
          is_founding_member?: boolean | null
          last_name?: string
          locked_start_date?: string | null
          member_id?: string
          membership_end_date?: string | null
          membership_start_date?: string
          membership_type?: string
          original_tier_at_application?: string | null
          phone?: string | null
          photo_url?: string | null
          referral_points_balance?: number
          referred_by_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier_change_used?: boolean | null
          tier_change_used_at?: string | null
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
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
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
          liability_waiver_signed: boolean | null
          lifestyle_integration: string | null
          membership_agreement_signed: boolean
          membership_plan: string
          motivations: string[] | null
          notes: string | null
          one_year_commitment: boolean
          other_goals: string | null
          other_motivation: string | null
          other_services: string | null
          payment_info_provided: boolean
          payment_link_sent_at: string | null
          phone: string
          previous_member: string | null
          referred_by_member: string
          services_interested: string[]
          skip_tour_activate_immediately: boolean | null
          state: string
          status: string
          stripe_customer_id: string | null
          submission_confirmation: boolean
          updated_at: string
          user_id: string | null
          wellness_goals: string[]
          zip_code: string
        }
        Insert: {
          address: string
          annual_fee_status?: string
          auth_acknowledgment?: boolean
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
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
          liability_waiver_signed?: boolean | null
          lifestyle_integration?: string | null
          membership_agreement_signed?: boolean
          membership_plan: string
          motivations?: string[] | null
          notes?: string | null
          one_year_commitment?: boolean
          other_goals?: string | null
          other_motivation?: string | null
          other_services?: string | null
          payment_info_provided?: boolean
          payment_link_sent_at?: string | null
          phone: string
          previous_member?: string | null
          referred_by_member: string
          services_interested?: string[]
          skip_tour_activate_immediately?: boolean | null
          state: string
          status?: string
          stripe_customer_id?: string | null
          submission_confirmation?: boolean
          updated_at?: string
          user_id?: string | null
          wellness_goals?: string[]
          zip_code: string
        }
        Update: {
          address?: string
          annual_fee_status?: string
          auth_acknowledgment?: boolean
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
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
          liability_waiver_signed?: boolean | null
          lifestyle_integration?: string | null
          membership_agreement_signed?: boolean
          membership_plan?: string
          motivations?: string[] | null
          notes?: string | null
          one_year_commitment?: boolean
          other_goals?: string | null
          other_motivation?: string | null
          other_services?: string | null
          payment_info_provided?: boolean
          payment_link_sent_at?: string | null
          phone?: string
          previous_member?: string | null
          referred_by_member?: string
          services_interested?: string[]
          skip_tour_activate_immediately?: boolean | null
          state?: string
          status?: string
          stripe_customer_id?: string | null
          submission_confirmation?: boolean
          updated_at?: string
          user_id?: string | null
          wellness_goals?: string[]
          zip_code?: string
        }
        Relationships: []
      }
      merch_inventory: {
        Row: {
          color: string
          id: string
          product_id: string
          quantity: number | null
          size: string
        }
        Insert: {
          color: string
          id?: string
          product_id: string
          quantity?: number | null
          size: string
        }
        Update: {
          color?: string
          id?: string
          product_id?: string
          quantity?: number | null
          size?: string
        }
        Relationships: [
          {
            foreignKeyName: "merch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merch_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_orders: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          is_preorder: boolean | null
          member_id: string | null
          notes: string | null
          order_items: Json
          payment_method: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          total_amount: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_preorder?: boolean | null
          member_id?: string | null
          notes?: string | null
          order_items?: Json
          payment_method?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_preorder?: boolean | null
          member_id?: string | null
          notes?: string | null
          order_items?: Json
          payment_method?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merch_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_products: {
        Row: {
          allow_preorder: boolean | null
          category: string | null
          colors: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          image_urls: string[] | null
          is_active: boolean | null
          name: string
          price: number
          sizes: string[] | null
          updated_at: string | null
        }
        Insert: {
          allow_preorder?: boolean | null
          category?: string | null
          colors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          name: string
          price: number
          sizes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          allow_preorder?: boolean | null
          category?: string | null
          colors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          name?: string
          price?: number
          sizes?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      non_member_profiles: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
          waiver_signed: boolean
          waiver_signed_at: string | null
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
          waiver_signed?: boolean
          waiver_signed_at?: string | null
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          waiver_signed?: boolean
          waiver_signed_at?: string | null
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount: number
          attempt_number: number | null
          created_at: string | null
          currency: string | null
          decline_code: string | null
          decline_reason: string | null
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          member_id: string | null
          next_retry_at: string | null
          status: string
          succeeded_at: string | null
        }
        Insert: {
          amount: number
          attempt_number?: number | null
          created_at?: string | null
          currency?: string | null
          decline_code?: string | null
          decline_reason?: string | null
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          member_id?: string | null
          next_retry_at?: string | null
          status: string
          succeeded_at?: string | null
        }
        Update: {
          amount?: number
          attempt_number?: number | null
          created_at?: string | null
          currency?: string | null
          decline_code?: string | null
          decline_reason?: string | null
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          member_id?: string | null
          next_retry_at?: string | null
          status?: string
          succeeded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_updates: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          event_type: string
          id: string
          is_default: boolean | null
          member_id: string | null
          payment_method_id: string | null
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          is_default?: boolean | null
          member_id?: string | null
          payment_method_id?: string | null
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          is_default?: boolean | null
          member_id?: string | null
          payment_method_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_updates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_updates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_updates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_non_member_imports: {
        Row: {
          classes_total: number
          created_at: string
          created_by: string | null
          email: string
          email_sent_at: string | null
          expiration_days: number
          first_name: string | null
          fulfilled_at: string | null
          fulfilled_user_id: string | null
          id: string
          last_name: string | null
          pass_category: Database["public"]["Enums"]["class_category"]
          pass_type: string
          phone: string | null
          status: string
        }
        Insert: {
          classes_total?: number
          created_at?: string
          created_by?: string | null
          email: string
          email_sent_at?: string | null
          expiration_days?: number
          first_name?: string | null
          fulfilled_at?: string | null
          fulfilled_user_id?: string | null
          id?: string
          last_name?: string | null
          pass_category?: Database["public"]["Enums"]["class_category"]
          pass_type?: string
          phone?: string | null
          status?: string
        }
        Update: {
          classes_total?: number
          created_at?: string
          created_by?: string | null
          email?: string
          email_sent_at?: string | null
          expiration_days?: number
          first_name?: string | null
          fulfilled_at?: string | null
          fulfilled_user_id?: string | null
          id?: string
          last_name?: string | null
          pass_category?: Database["public"]["Enums"]["class_category"]
          pass_type?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      processed_webhook_events: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string
          processing_result: string | null
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string
          processing_result?: string | null
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string
          processing_result?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          class_package_agreement_signed: boolean | null
          class_package_agreement_signed_at: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          fitness_goals: string | null
          guest_pass_agreement_signed: boolean | null
          guest_pass_agreement_signed_at: string | null
          id: string
          kids_care_agreement_signed: boolean | null
          kids_care_agreement_signed_at: string | null
          kids_care_service_form_completed: boolean | null
          kids_care_service_form_completed_at: string | null
          last_name: string
          manager_refund_code: string | null
          membership_agreement_signed: boolean
          membership_agreement_signed_at: string | null
          phone: string | null
          private_event_agreement_signed: boolean | null
          private_event_agreement_signed_at: string | null
          single_class_pass_agreement_signed: boolean | null
          single_class_pass_agreement_signed_at: string | null
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
          class_package_agreement_signed?: boolean | null
          class_package_agreement_signed_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          fitness_goals?: string | null
          guest_pass_agreement_signed?: boolean | null
          guest_pass_agreement_signed_at?: string | null
          id?: string
          kids_care_agreement_signed?: boolean | null
          kids_care_agreement_signed_at?: string | null
          kids_care_service_form_completed?: boolean | null
          kids_care_service_form_completed_at?: string | null
          last_name: string
          manager_refund_code?: string | null
          membership_agreement_signed?: boolean
          membership_agreement_signed_at?: string | null
          phone?: string | null
          private_event_agreement_signed?: boolean | null
          private_event_agreement_signed_at?: string | null
          single_class_pass_agreement_signed?: boolean | null
          single_class_pass_agreement_signed_at?: string | null
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
          class_package_agreement_signed?: boolean | null
          class_package_agreement_signed_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          fitness_goals?: string | null
          guest_pass_agreement_signed?: boolean | null
          guest_pass_agreement_signed_at?: string | null
          id?: string
          kids_care_agreement_signed?: boolean | null
          kids_care_agreement_signed_at?: string | null
          kids_care_service_form_completed?: boolean | null
          kids_care_service_form_completed_at?: string | null
          last_name?: string
          manager_refund_code?: string | null
          membership_agreement_signed?: boolean
          membership_agreement_signed_at?: string | null
          phone?: string | null
          private_event_agreement_signed?: boolean | null
          private_event_agreement_signed_at?: string | null
          single_class_pass_agreement_signed?: boolean | null
          single_class_pass_agreement_signed_at?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          waiver_signed?: boolean
          waiver_signed_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      program_workouts: {
        Row: {
          completed_at: string | null
          created_at: string
          day_number: number
          duration_minutes: number | null
          exercises: Json
          focus_area: string | null
          id: string
          is_completed: boolean | null
          notes: string | null
          program_id: string
          updated_at: string
          week_number: number
          workout_name: string
          workout_type: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_number: number
          duration_minutes?: number | null
          exercises?: Json
          focus_area?: string | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          program_id: string
          updated_at?: string
          week_number: number
          workout_name: string
          workout_type?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_number?: number
          duration_minutes?: number | null
          exercises?: Json
          focus_area?: string | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          program_id?: string
          updated_at?: string
          week_number?: number
          workout_name?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_campaign_log: {
        Row: {
          credits_allocated: number
          id: string
          members_errored: number
          members_skipped: number
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          credits_allocated?: number
          id?: string
          members_errored?: number
          members_skipped?: number
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          credits_allocated?: number
          id?: string
          members_errored?: number
          members_skipped?: number
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_point_transactions: {
        Row: {
          created_at: string
          description: string
          id: string
          member_id: string
          points: number
          reference_id: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          member_id: string
          points: number
          reference_id?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          member_id?: string
          points?: number
          reference_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          amount_cents: number
          approved_by: string | null
          charge_type: string
          created_at: string
          currency: string
          error_message: string | null
          id: string
          manager_code: string | null
          member_id: string | null
          original_charge_id: string | null
          original_payment_intent_id: string | null
          processed_at: string | null
          reason: string | null
          refund_type: string
          requested_by: string | null
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approved_by?: string | null
          charge_type: string
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          manager_code?: string | null
          member_id?: string | null
          original_charge_id?: string | null
          original_payment_intent_id?: string | null
          processed_at?: string | null
          reason?: string | null
          refund_type?: string
          requested_by?: string | null
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approved_by?: string | null
          charge_type?: string
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          manager_code?: string | null
          member_id?: string | null
          original_charge_id?: string | null
          original_payment_intent_id?: string | null
          processed_at?: string | null
          reason?: string | null
          refund_type?: string
          requested_by?: string | null
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_original_charge_id_fkey"
            columns: ["original_charge_id"]
            isOneToOne: false
            referencedRelation: "manual_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      scanner_access_logs: {
        Row: {
          access_denied_reason: string | null
          access_granted: boolean
          auto_checked_in: boolean | null
          check_in_id: string | null
          device_type: string | null
          id: string
          member_id: string | null
          member_id_text: string | null
          notes: string | null
          override_reason: string | null
          override_used: boolean | null
          payment_status: Json | null
          scanned_at: string | null
          scanned_by: string | null
        }
        Insert: {
          access_denied_reason?: string | null
          access_granted: boolean
          auto_checked_in?: boolean | null
          check_in_id?: string | null
          device_type?: string | null
          id?: string
          member_id?: string | null
          member_id_text?: string | null
          notes?: string | null
          override_reason?: string | null
          override_used?: boolean | null
          payment_status?: Json | null
          scanned_at?: string | null
          scanned_by?: string | null
        }
        Update: {
          access_denied_reason?: string | null
          access_granted?: boolean
          auto_checked_in?: boolean | null
          check_in_id?: string | null
          device_type?: string | null
          id?: string
          member_id?: string | null
          member_id_text?: string | null
          notes?: string | null
          override_reason?: string | null
          override_used?: boolean | null
          payment_status?: Json | null
          scanned_at?: string | null
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scanner_access_logs_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_access_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_access_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_access_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      scanner_settings: {
        Row: {
          audio_feedback_enabled: boolean | null
          auto_check_in_enabled: boolean | null
          created_at: string | null
          id: string
          location_name: string
          qr_token_secret: string | null
          require_override_reason: boolean | null
          updated_at: string | null
        }
        Insert: {
          audio_feedback_enabled?: boolean | null
          auto_check_in_enabled?: boolean | null
          created_at?: string | null
          id?: string
          location_name: string
          qr_token_secret?: string | null
          require_override_reason?: boolean | null
          updated_at?: string | null
        }
        Update: {
          audio_feedback_enabled?: boolean | null
          auto_check_in_enabled?: boolean | null
          created_at?: string | null
          id?: string
          location_name?: string
          qr_token_secret?: string | null
          require_override_reason?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_functions_config: {
        Row: {
          anon_key: string | null
          created_at: string | null
          id: string
          supabase_url: string
          updated_at: string | null
        }
        Insert: {
          anon_key?: string | null
          created_at?: string | null
          id?: string
          supabase_url?: string
          updated_at?: string | null
        }
        Update: {
          anon_key?: string | null
          created_at?: string | null
          id?: string
          supabase_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          message_body: string
          phone: string
          sent_at: string | null
          status: Database["public"]["Enums"]["sms_status"]
          twilio_sid: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_body: string
          phone: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          twilio_sid?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_body?: string
          phone?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      spa_appointments: {
        Row: {
          amount_paid: number | null
          appointment_date: string
          appointment_time: string
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          cleanup_minutes: number
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          member_id: string | null
          member_notes: string | null
          member_price: number | null
          payment_intent_id: string | null
          payment_method: string | null
          service_category: string
          service_id: number
          service_name: string
          service_price: number
          staff_id: string | null
          staff_notes: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          appointment_date: string
          appointment_time: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          cleanup_minutes?: number
          completed_at?: string | null
          created_at?: string
          duration_minutes: number
          id?: string
          member_id?: string | null
          member_notes?: string | null
          member_price?: number | null
          payment_intent_id?: string | null
          payment_method?: string | null
          service_category: string
          service_id: number
          service_name: string
          service_price: number
          staff_id?: string | null
          staff_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          appointment_date?: string
          appointment_time?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          cleanup_minutes?: number
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          member_id?: string | null
          member_notes?: string | null
          member_price?: number | null
          payment_intent_id?: string | null
          payment_method?: string | null
          service_category?: string
          service_id?: number
          service_name?: string
          service_price?: number
          staff_id?: string | null
          staff_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spa_appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spa_appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spa_appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          created_by: string
          id: string
          member_ids: string[] | null
          name: string
          visible_to_roles: Database["public"]["Enums"]["app_role"][] | null
        }
        Insert: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by: string
          id?: string
          member_ids?: string[] | null
          name: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by?: string
          id?: string
          member_ids?: string[] | null
          name?: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          claimed_at: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          roles: Database["public"]["Enums"]["app_role"][]
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          status?: string
        }
        Relationships: []
      }
      staff_messages: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          is_read_by: string[] | null
          message_body: string
          sender_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          is_read_by?: string[] | null
          message_body: string
          sender_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          is_read_by?: string[] | null
          message_body?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "staff_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"]
          visible_to_roles: Database["public"]["Enums"]["app_role"][] | null
          visible_to_users: string[] | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
          visible_to_users?: string[] | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
          visible_to_users?: string[] | null
        }
        Relationships: []
      }
      staff_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          visible_to_roles: Database["public"]["Enums"]["app_role"][] | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Relationships: []
      }
      subscription_status_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          member_id: string | null
          new_status: string
          old_status: string | null
          stripe_event_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
          new_status: string
          old_status?: string | null
          stripe_event_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
          new_status?: string
          old_status?: string | null
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_status_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_status_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_status_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
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
          exercises: Json | null
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
          exercises?: Json | null
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
          exercises?: Json | null
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
            referencedRelation: "member_limited_view"
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
      workout_programs: {
        Row: {
          ai_reasoning: string | null
          completed_at: string | null
          created_at: string
          current_week: number | null
          days_per_week: number
          difficulty: string | null
          duration_weeks: number
          id: string
          is_active: boolean | null
          member_id: string
          program_name: string
          program_type: string
          progression_style: string | null
          split_type: string | null
          started_at: string | null
          target_body_parts: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string
          current_week?: number | null
          days_per_week: number
          difficulty?: string | null
          duration_weeks?: number
          id?: string
          is_active?: boolean | null
          member_id: string
          program_name: string
          program_type: string
          progression_style?: string | null
          split_type?: string | null
          started_at?: string | null
          target_body_parts?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string
          current_week?: number | null
          days_per_week?: number
          difficulty?: string | null
          duration_weeks?: number
          id?: string
          is_active?: boolean | null
          member_id?: string
          program_name?: string
          program_type?: string
          progression_style?: string | null
          split_type?: string | null
          started_at?: string | null
          target_body_parts?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_programs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_programs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_programs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          estimated_duration_minutes: number | null
          exercises: Json | null
          id: string
          is_favorite: boolean
          member_id: string
          notes: string | null
          template_name: string
          times_used: number
          updated_at: string
          user_id: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          estimated_duration_minutes?: number | null
          exercises?: Json | null
          id?: string
          is_favorite?: boolean
          member_id: string
          notes?: string | null
          template_name: string
          times_used?: number
          updated_at?: string
          user_id: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          estimated_duration_minutes?: number | null
          exercises?: Json | null
          id?: string
          is_favorite?: boolean
          member_id?: string
          notes?: string | null
          template_name?: string
          times_used?: number
          updated_at?: string
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_check_in_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_templates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_limited_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_templates_member_id_fkey"
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
            referencedRelation: "member_limited_view"
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
          email: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          last_name: string | null
          member_id: string | null
          membership_type: string | null
          phone: string | null
          photo_url: string | null
          status: string | null
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          member_id?: string | null
          membership_type?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string | null
        }
        Update: {
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          member_id?: string | null
          membership_type?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string | null
        }
        Relationships: []
      }
      member_limited_view: {
        Row: {
          activated_at: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          is_founding_member: boolean | null
          last_name: string | null
          member_id: string | null
          membership_end_date: string | null
          membership_start_date: string | null
          membership_type: string | null
          phone: string | null
          photo_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          is_founding_member?: boolean | null
          last_name?: string | null
          member_id?: string | null
          membership_end_date?: string | null
          membership_start_date?: string | null
          membership_type?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          is_founding_member?: boolean | null
          last_name?: string | null
          member_id?: string | null
          membership_end_date?: string | null
          membership_start_date?: string | null
          membership_type?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_instructors_view: {
        Row: {
          bio: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          photo_url: string | null
          specialties: string[] | null
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
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cancel_class_session: {
        Args: {
          _cancellation_reason?: string
          _is_hidden?: boolean
          _session_id: string
        }
        Returns: Json
      }
      admin_cancel_kids_care_booking: {
        Args: { p_booking_id: string; p_cancellation_reason?: string }
        Returns: Json
      }
      admin_create_kids_care_booking: {
        Args: {
          p_booking_date: string
          p_child_age: number
          p_child_name: string
          p_end_time: string
          p_member_id: string
          p_pass_id: string
          p_special_instructions?: string
          p_start_time: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_link_member_to_user: {
        Args: { _member_id: string; _user_email: string }
        Returns: boolean
      }
      award_referral_points: {
        Args: { _referred_member_id: string; _referring_member_id: string }
        Returns: undefined
      }
      book_wellness_appointment: {
        Args: {
          p_appointment_date: string
          p_appointment_time: string
          p_cleanup_minutes: number
          p_credit_type: string
          p_duration_minutes: number
          p_member_notes?: string
          p_service_category: string
          p_service_id: number
          p_service_name: string
          p_service_price: number
        }
        Returns: Json
      }
      calculate_churn_risk: { Args: { p_member_id: string }; Returns: number }
      calculate_engagement_score: {
        Args: { p_days?: number; p_member_id: string }
        Returns: number
      }
      calculate_health_score: { Args: { _member_id: string }; Returns: number }
      calculate_member_ltv: { Args: { p_member_id: string }; Returns: number }
      cancel_class_booking: { Args: { _booking_id: string }; Returns: Json }
      check_and_award_achievements: {
        Args: { _member_id: string }
        Returns: undefined
      }
      check_for_duplicate_check_in: {
        Args: { p_check_in_window_minutes?: number; p_member_id: string }
        Returns: boolean
      }
      check_goal_milestones: { Args: { _goal_id: string }; Returns: undefined }
      check_spa_appointment_conflict: {
        Args: {
          p_appointment_date: string
          p_appointment_time: string
          p_cleanup_minutes?: number
          p_duration_minutes: number
          p_exclude_appointment_id?: string
          p_staff_id?: string
        }
        Returns: {
          conflicting_appointment_id: string
          has_conflict: boolean
        }[]
      }
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
      current_user_email_lower: { Args: never; Returns: string }
      find_or_create_temp_class_session: {
        Args: {
          _class_name: string
          _end_time: string
          _max_capacity?: number
          _session_date: string
          _start_time: string
        }
        Returns: string
      }
      generate_class_sessions: {
        Args: { _start_date?: string; _weeks_ahead?: number }
        Returns: {
          sessions_created: number
          sessions_skipped: number
        }[]
      }
      generate_referral_code: { Args: { _member_id: string }; Returns: string }
      get_admin_kids_care_bookings: {
        Args: {
          p_age_group?: string
          p_booking_date?: string
          p_date_from?: string
          p_date_to?: string
          p_member_id?: string
          p_status?: string
        }
        Returns: {
          age_group: string
          booking_date: string
          checked_in_at: string
          checked_in_by: string
          checked_out_at: string
          checked_out_by: string
          child_age: number
          child_allergies: string
          child_authorized_pickup_persons: string
          child_emergency_contact_name: string
          child_emergency_contact_phone: string
          child_medical_conditions: string
          child_medications: string
          child_name: string
          child_photo_release: boolean
          child_relationship_to_child: string
          child_special_instructions: string
          created_at: string
          end_time: string
          id: string
          member_id: string
          parent_confirmed_at: string
          parent_confirmed_pickup: boolean
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          room: string
          special_instructions: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      get_all_class_type_ratings: {
        Args: never
        Returns: {
          average_rating: number
          class_type_id: string
          review_count: number
        }[]
      }
      get_class_type_ratings: {
        Args: { _class_type_id: string }
        Returns: {
          average_rating: number
          review_count: number
        }[]
      }
      get_dunning_efficiency: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_member_attendance_pattern: {
        Args: { p_days?: number; p_member_id: string }
        Returns: Json
      }
      get_member_payment_history: {
        Args: { p_limit?: number; p_member_id: string }
        Returns: Json
      }
      get_member_service_utilization: {
        Args: { p_days?: number; p_member_id: string }
        Returns: Json
      }
      get_payment_metrics: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_scheduled_functions_config: {
        Args: never
        Returns: {
          anon_key: string
          supabase_url: string
        }[]
      }
      get_subscription_health: { Args: never; Returns: Json }
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
      is_email_blocked: { Args: { p_email: string }; Returns: boolean }
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
      log_payment_attempt: {
        Args: {
          p_amount: number
          p_attempt_number?: number
          p_currency: string
          p_decline_code?: string
          p_decline_reason?: string
          p_failure_code?: string
          p_failure_message?: string
          p_invoice_id: string
          p_invoice_number: string
          p_member_id: string
          p_next_retry_at?: string
          p_status: string
        }
        Returns: string
      }
      mark_guest_pass_used: { Args: { p_pass_id: string }; Returns: Json }
      process_member_scan:
        | {
            Args: {
              p_auto_check_in?: boolean
              p_device_type?: string
              p_member_id_text: string
              p_override?: boolean
              p_override_reason?: string
              p_scanned_by: string
            }
            Returns: Json
          }
        | { Args: { p_scanned_code: string }; Returns: Json }
      redeem_guest_pass_credit: {
        Args: {
          p_guest_email: string
          p_guest_first_name: string
          p_guest_last_name: string
          p_guest_phone: string
          p_visit_date: string
        }
        Returns: Json
      }
      redeem_referral_points: {
        Args: { _member_id: string; _points_cost: number; _reward_type: string }
        Returns: Json
      }
      track_payment_method_update: {
        Args: {
          p_card_brand?: string
          p_card_exp_month?: number
          p_card_exp_year?: number
          p_card_last4?: string
          p_event_type: string
          p_is_default?: boolean
          p_member_id: string
          p_payment_method_id: string
        }
        Returns: string
      }
      update_subscription_status_with_history: {
        Args: {
          p_change_reason?: string
          p_changed_by?: string
          p_member_id: string
          p_new_status: string
          p_stripe_event_id?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      amenity_type:
        | "sauna"
        | "salt_room"
        | "cold_plunge"
        | "steam_room"
        | "zero_body_cryo"
        | "red_light_therapy"
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
      channel_type: "general" | "department" | "direct"
      class_category:
        | "pilates_cycling"
        | "other"
        | "reformer"
        | "cycling"
        | "aerobics"
      conversation_status: "open" | "in_progress" | "resolved" | "closed"
      credit_type: "class" | "red_light" | "dry_cryo" | "guest_pass"
      enrollment_status: "active" | "completed" | "cancelled" | "paused"
      marketing_source:
        | "import"
        | "guest_pass"
        | "application"
        | "member"
        | "manual"
      message_sender_type: "member" | "staff"
      note_visibility: "all_staff" | "specific_roles" | "specific_users"
      pass_status: "active" | "expired" | "exhausted"
      sequence_channel: "email" | "sms" | "both"
      sequence_trigger:
        | "guest_visit"
        | "membership_activated"
        | "dormant_14d"
        | "dormant_30d"
        | "membership_anniversary"
        | "post_class"
        | "churn_risk"
        | "manual"
      sms_status: "queued" | "sent" | "failed" | "delivered" | "undelivered"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done"
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
      amenity_type: [
        "sauna",
        "salt_room",
        "cold_plunge",
        "steam_room",
        "zero_body_cryo",
        "red_light_therapy",
      ],
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
      channel_type: ["general", "department", "direct"],
      class_category: [
        "pilates_cycling",
        "other",
        "reformer",
        "cycling",
        "aerobics",
      ],
      conversation_status: ["open", "in_progress", "resolved", "closed"],
      credit_type: ["class", "red_light", "dry_cryo", "guest_pass"],
      enrollment_status: ["active", "completed", "cancelled", "paused"],
      marketing_source: [
        "import",
        "guest_pass",
        "application",
        "member",
        "manual",
      ],
      message_sender_type: ["member", "staff"],
      note_visibility: ["all_staff", "specific_roles", "specific_users"],
      pass_status: ["active", "expired", "exhausted"],
      sequence_channel: ["email", "sms", "both"],
      sequence_trigger: [
        "guest_visit",
        "membership_activated",
        "dormant_14d",
        "dormant_30d",
        "membership_anniversary",
        "post_class",
        "churn_risk",
        "manual",
      ],
      sms_status: ["queued", "sent", "failed", "delivered", "undelivered"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done"],
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
