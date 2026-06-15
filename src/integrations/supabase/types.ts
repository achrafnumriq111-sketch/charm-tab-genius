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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          employee_id: string | null
          employee_name: string | null
          employee_role: string | null
          id: string
          location_id: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          employee_id?: string | null
          employee_name?: string | null
          employee_role?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          employee_id?: string | null
          employee_name?: string | null
          employee_role?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_log: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          id: string
          ip_address: string | null
          started_at: string
          target_tenant_id: string
          target_tenant_name: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          target_tenant_id: string
          target_tenant_name?: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          target_tenant_id?: string
          target_tenant_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_log_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_daily_facts: {
        Row: {
          avg_order_value: number
          card_revenue: number | null
          cash_revenue: number | null
          created_at: string
          date: string
          discount_total: number | null
          holiday_name: string | null
          id: string
          is_holiday: boolean | null
          labor_cost: number | null
          labor_hours: number | null
          location_id: string
          month: number
          omzet: number
          orders_count: number
          refund_total: number | null
          season: string
          updated_at: string
          week_number: number
          weekday: number
        }
        Insert: {
          avg_order_value?: number
          card_revenue?: number | null
          cash_revenue?: number | null
          created_at?: string
          date: string
          discount_total?: number | null
          holiday_name?: string | null
          id?: string
          is_holiday?: boolean | null
          labor_cost?: number | null
          labor_hours?: number | null
          location_id: string
          month?: number
          omzet?: number
          orders_count?: number
          refund_total?: number | null
          season?: string
          updated_at?: string
          week_number?: number
          weekday?: number
        }
        Update: {
          avg_order_value?: number
          card_revenue?: number | null
          cash_revenue?: number | null
          created_at?: string
          date?: string
          discount_total?: number | null
          holiday_name?: string | null
          id?: string
          is_holiday?: boolean | null
          labor_cost?: number | null
          labor_hours?: number | null
          location_id?: string
          month?: number
          omzet?: number
          orders_count?: number
          refund_total?: number | null
          season?: string
          updated_at?: string
          week_number?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_daily_facts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hourly_facts: {
        Row: {
          avg_order_value: number
          created_at: string
          date: string
          id: string
          is_peak: boolean | null
          is_weekend: boolean | null
          labor_cost: number | null
          local_hour: number
          location_id: string
          omzet: number
          orders_count: number
          staff_count: number | null
          updated_at: string
          weekday: number
        }
        Insert: {
          avg_order_value?: number
          created_at?: string
          date: string
          id?: string
          is_peak?: boolean | null
          is_weekend?: boolean | null
          labor_cost?: number | null
          local_hour: number
          location_id: string
          omzet?: number
          orders_count?: number
          staff_count?: number | null
          updated_at?: string
          weekday?: number
        }
        Update: {
          avg_order_value?: number
          created_at?: string
          date?: string
          id?: string
          is_peak?: boolean | null
          is_weekend?: boolean | null
          labor_cost?: number | null
          local_hour?: number
          location_id?: string
          omzet?: number
          orders_count?: number
          staff_count?: number | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hourly_facts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_audit_notes: {
        Row: {
          action_type: string
          cash_closing_id: string
          created_at: string
          employee_name: string
          id: string
          location_id: string
          note_text: string
        }
        Insert: {
          action_type?: string
          cash_closing_id: string
          created_at?: string
          employee_name: string
          id?: string
          location_id: string
          note_text: string
        }
        Update: {
          action_type?: string
          cash_closing_id?: string
          created_at?: string
          employee_name?: string
          id?: string
          location_id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_audit_notes_cash_closing_id_fkey"
            columns: ["cash_closing_id"]
            isOneToOne: false
            referencedRelation: "cash_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_audit_notes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_closings: {
        Row: {
          closing_date: string
          counted_cash: number
          created_at: string
          difference: number
          envelope_amount: number
          envelope_code: string
          expected_cash_revenue: number
          expected_envelope: number
          expense_note: string | null
          expense_receipts: number
          float_amount: number
          id: string
          idempotency_key: string | null
          location_id: string
          primary_employee_id: string
          primary_employee_name: string
          second_checker_id: string
          second_checker_name: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          closing_date?: string
          counted_cash?: number
          created_at?: string
          difference?: number
          envelope_amount?: number
          envelope_code: string
          expected_cash_revenue?: number
          expected_envelope?: number
          expense_note?: string | null
          expense_receipts?: number
          float_amount?: number
          id?: string
          idempotency_key?: string | null
          location_id: string
          primary_employee_id: string
          primary_employee_name: string
          second_checker_id: string
          second_checker_name: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          closing_date?: string
          counted_cash?: number
          created_at?: string
          difference?: number
          envelope_amount?: number
          envelope_code?: string
          expected_cash_revenue?: number
          expected_envelope?: number
          expense_note?: string | null
          expense_receipts?: number
          float_amount?: number
          id?: string
          idempotency_key?: string | null
          location_id?: string
          primary_employee_id?: string
          primary_employee_name?: string
          second_checker_id?: string
          second_checker_name?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          first_seen_at: string
          full_name: string
          id: string
          last_seen_at: string
          location_id: string | null
          marketing_opt_in: boolean
          notes: string | null
          passkit_member_id: string | null
          phone: string | null
          source: string
          tenant_id: string | null
          total_spent: number
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_seen_at?: string
          full_name: string
          id?: string
          last_seen_at?: string
          location_id?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          passkit_member_id?: string | null
          phone?: string | null
          source?: string
          tenant_id?: string | null
          total_spent?: number
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          first_seen_at?: string
          full_name?: string
          id?: string
          last_seen_at?: string
          location_id?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          passkit_member_id?: string | null
          phone?: string | null
          source?: string
          tenant_id?: string | null
          total_spent?: number
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      device_pairing_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          created_by: string | null
          device_name: string
          expires_at: string
          id: string
          location_id: string
          tenant_id: string
          used_at: string | null
          used_by_device_id: string | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          created_by?: string | null
          device_name: string
          expires_at: string
          id?: string
          location_id: string
          tenant_id: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          created_by?: string | null
          device_name?: string
          expires_at?: string
          id?: string
          location_id?: string
          tenant_id?: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_pairing_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_codes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_codes_used_by_device_id_fkey"
            columns: ["used_by_device_id"]
            isOneToOne: false
            referencedRelation: "trusted_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          created_at: string
          discount_type: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          sort_order: number
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          discount_type?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          sort_order?: number
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          discount_type?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_invites: {
        Row: {
          accepted_at: string | null
          accepted_employee_id: string | null
          created_at: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          location_id: string
          role: Database["public"]["Enums"]["employee_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_employee_id?: string | null
          created_at?: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          location_id: string
          role?: Database["public"]["Enums"]["employee_role"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_employee_id?: string | null
          created_at?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          location_id?: string
          role?: Database["public"]["Enums"]["employee_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_invites_accepted_employee_id_fkey"
            columns: ["accepted_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invites_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          failed_login_attempts: number
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          location_id: string
          locked_until: string | null
          role: Database["public"]["Enums"]["employee_role"]
          tenant_id: string | null
          updated_at: string
          user_id: string | null
          username_normalized: string
        }
        Insert: {
          created_at?: string
          failed_login_attempts?: number
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          location_id: string
          locked_until?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
          username_normalized: string
        }
        Update: {
          created_at?: string
          failed_login_attempts?: number
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          location_id?: string
          locked_until?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
          username_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_tables: {
        Row: {
          created_at: string
          h: number
          id: string
          is_active: boolean
          location_id: string
          name: string
          seats: number
          shape: string
          updated_at: string
          w: number
          x: number
          y: number
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          h?: number
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          seats?: number
          shape?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          h?: number
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          seats?: number
          shape?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_tables_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_tables_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "floor_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_zones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_zones_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_learning_metrics: {
        Row: {
          absolute_error: number | null
          actual_value: number | null
          confidence: number
          contributing_signals: Json | null
          created_at: string
          forecast_date: string
          forecast_target: string
          id: string
          location_id: string
          model_scope: string
          percent_error: number | null
          predicted_value: number
        }
        Insert: {
          absolute_error?: number | null
          actual_value?: number | null
          confidence?: number
          contributing_signals?: Json | null
          created_at?: string
          forecast_date: string
          forecast_target?: string
          id?: string
          location_id: string
          model_scope?: string
          percent_error?: number | null
          predicted_value?: number
        }
        Update: {
          absolute_error?: number | null
          actual_value?: number | null
          confidence?: number
          contributing_signals?: Json | null
          created_at?: string
          forecast_date?: string
          forecast_target?: string
          id?: string
          location_id?: string
          model_scope?: string
          percent_error?: number | null
          predicted_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecast_learning_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance: number
          code: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          initial_value: number
          issued_at: string
          issued_by_employee_id: string | null
          issued_by_employee_name: string | null
          location_id: string
          passkit_enrolled: boolean
          passkit_member_id: string | null
          source_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          balance?: number
          code: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          initial_value?: number
          issued_at?: string
          issued_by_employee_id?: string | null
          issued_by_employee_name?: string | null
          location_id: string
          passkit_enrolled?: boolean
          passkit_member_id?: string | null
          source_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          initial_value?: number
          issued_at?: string
          issued_by_employee_id?: string | null
          issued_by_employee_name?: string | null
          location_id?: string
          passkit_enrolled?: boolean
          passkit_member_id?: string | null
          source_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          ai_forecast_enabled: boolean
          avg_monthly_usage: number
          category: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit: number
          created_at: string
          current_stock: number
          id: string
          is_dynamic: boolean
          item_name: string
          last_count_date: string | null
          last_delivery_date: string | null
          location: string | null
          location_id: string
          minimum_stock: number
          recommended_threshold: number
          reorder_level: number
          sku: string | null
          supplier: string | null
          tenant_id: string | null
          unit_type: string
          updated_at: string
          waste_percentage: number
        }
        Insert: {
          ai_forecast_enabled?: boolean
          avg_monthly_usage?: number
          category?: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_dynamic?: boolean
          item_name: string
          last_count_date?: string | null
          last_delivery_date?: string | null
          location?: string | null
          location_id: string
          minimum_stock?: number
          recommended_threshold?: number
          reorder_level?: number
          sku?: string | null
          supplier?: string | null
          tenant_id?: string | null
          unit_type?: string
          updated_at?: string
          waste_percentage?: number
        }
        Update: {
          ai_forecast_enabled?: boolean
          avg_monthly_usage?: number
          category?: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_dynamic?: boolean
          item_name?: string
          last_count_date?: string | null
          last_delivery_date?: string | null
          location?: string | null
          location_id?: string
          minimum_stock?: number
          recommended_threshold?: number
          reorder_level?: number
          sku?: string | null
          supplier?: string | null
          tenant_id?: string | null
          unit_type?: string
          updated_at?: string
          waste_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_settings: {
        Row: {
          auto_enrol: boolean
          created_at: string
          extra: Json | null
          feature_kitchen: boolean
          feature_leat: boolean
          feature_passkit: boolean
          feature_piggy: boolean
          feature_qr: boolean
          feature_tips: boolean
          location_id: string
          passkit_program_id: string | null
          passkit_tier_id: string | null
          points_per_euro: number
          updated_at: string
        }
        Insert: {
          auto_enrol?: boolean
          created_at?: string
          extra?: Json | null
          feature_kitchen?: boolean
          feature_leat?: boolean
          feature_passkit?: boolean
          feature_piggy?: boolean
          feature_qr?: boolean
          feature_tips?: boolean
          location_id: string
          passkit_program_id?: string | null
          passkit_tier_id?: string | null
          points_per_euro?: number
          updated_at?: string
        }
        Update: {
          auto_enrol?: boolean
          created_at?: string
          extra?: Json | null
          feature_kitchen?: boolean
          feature_leat?: boolean
          feature_passkit?: boolean
          feature_piggy?: boolean
          feature_qr?: boolean
          feature_tips?: boolean
          location_id?: string
          passkit_program_id?: string | null
          passkit_tier_id?: string | null
          points_per_euro?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string
          city: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      login_audit_logs: {
        Row: {
          created_at: string
          details: Json | null
          employee_id: string | null
          event_type: string
          id: string
          ip_address: string | null
          location_id: string | null
          user_agent: string | null
          username_attempted: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          location_id?: string | null
          user_agent?: string | null
          username_attempted?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          location_id?: string | null
          user_agent?: string | null
          username_attempted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_audit_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_campaigns: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          delivered_count: number
          id: string
          message: string
          name: string
          recipients_count: number
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          id?: string
          message: string
          name: string
          recipients_count?: number
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          id?: string
          message?: string
          name?: string
          recipients_count?: number
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          min_total_spent: number
          min_visit_count: number
          name: string
          perks: string | null
          point_multiplier: number
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_total_spent?: number
          min_visit_count?: number
          name: string
          perks?: string | null
          point_multiplier?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_total_spent?: number
          min_visit_count?: number
          name?: string
          perks?: string | null
          point_multiplier?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_targets: {
        Row: {
          category: string
          created_at: string
          id: string
          location_id: string
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          location_id: string
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          location_id?: string
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_targets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_required: boolean
          location_id: string
          max_select: number
          min_select: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          location_id: string
          max_select?: number
          min_select?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          location_id?: string
          max_select?: number
          min_select?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          cost_price: number
          created_at: string
          display_order: number
          extra_price: number
          group_id: string
          id: string
          is_active: boolean
          is_default: boolean
          location_id: string
          name: string
          stock_sensitive: boolean
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          display_order?: number
          extra_price?: number
          group_id: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_id: string
          name: string
          stock_sensitive?: boolean
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          display_order?: number
          extra_price?: number
          group_id?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_id?: string
          name?: string
          stock_sensitive?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_transactions: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          discount_name: string | null
          employee_id: string | null
          employee_name: string | null
          gift_card_deduction: number
          gift_card_id: string | null
          id: string
          idempotency_key: string | null
          items: Json
          location_id: string
          loyalty_id: string | null
          loyalty_provider: string | null
          order_id: string
          payment_method: string
          source: string
          status: string
          subtotal: number
          table_id: string | null
          tenant_id: string | null
          tip: number
          total: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          discount_name?: string | null
          employee_id?: string | null
          employee_name?: string | null
          gift_card_deduction?: number
          gift_card_id?: string | null
          id?: string
          idempotency_key?: string | null
          items?: Json
          location_id: string
          loyalty_id?: string | null
          loyalty_provider?: string | null
          order_id: string
          payment_method?: string
          source?: string
          status?: string
          subtotal?: number
          table_id?: string | null
          tenant_id?: string | null
          tip?: number
          total?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          discount_name?: string | null
          employee_id?: string | null
          employee_name?: string | null
          gift_card_deduction?: number
          gift_card_id?: string | null
          id?: string
          idempotency_key?: string | null
          items?: Json
          location_id?: string
          loyalty_id?: string | null
          loyalty_provider?: string | null
          order_id?: string
          payment_method?: string
          source?: string
          status?: string
          subtotal?: number
          table_id?: string | null
          tenant_id?: string | null
          tip?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          buying_price: number
          created_at: string | null
          id: string
          location_id: string
          product_name: string
          selling_price: number | null
          updated_at: string | null
        }
        Insert: {
          buying_price?: number
          created_at?: string | null
          id?: string
          location_id: string
          product_name: string
          selling_price?: number | null
          updated_at?: string | null
        }
        Update: {
          buying_price?: number
          created_at?: string | null
          id?: string
          location_id?: string
          product_name?: string
          selling_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifier_groups: {
        Row: {
          created_at: string
          id: string
          location_id: string
          modifier_group_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          modifier_group_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          modifier_group_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifier_groups_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_modifier_groups_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          is_optional: boolean
          location_id: string
          product_id: string
          product_name: string
          quantity: number
          unit: string
          updated_at: string
          waste_factor_pct: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          is_optional?: boolean
          location_id: string
          product_id: string
          product_name: string
          quantity?: number
          unit?: string
          updated_at?: string
          waste_factor_pct?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          is_optional?: boolean
          location_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit?: string
          updated_at?: string
          waste_factor_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          color: string | null
          cost_price: number
          created_at: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          price: number
          section: string
          sort_order: number
          tags: string[] | null
          tenant_id: string | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          color?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          price?: number
          section?: string
          sort_order?: number
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          color?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          price?: number
          section?: string
          sort_order?: number
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          idempotency_key: string | null
          items: Json
          location_id: string
          status: string
          table_id: string
          tenant_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          idempotency_key?: string | null
          items?: Json
          location_id: string
          status?: string
          table_id: string
          tenant_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          idempotency_key?: string | null
          items?: Json
          location_id?: string
          status?: string
          table_id?: string
          tenant_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          email: string | null
          employee_id: string | null
          guest_name: string
          guests: number
          id: string
          location_id: string
          notes: string | null
          phone: string | null
          reservation_date: string
          reservation_time: string
          status: string
          table_id: string | null
          table_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_id?: string | null
          guest_name: string
          guests?: number
          id?: string
          location_id: string
          notes?: string | null
          phone?: string | null
          reservation_date: string
          reservation_time: string
          status?: string
          table_id?: string | null
          table_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_id?: string | null
          guest_name?: string
          guests?: number
          id?: string
          location_id?: string
          notes?: string | null
          phone?: string | null
          reservation_date?: string
          reservation_time?: string
          status?: string
          table_id?: string | null
          table_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "floor_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          location_id: string
          permission_key: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          location_id: string
          permission_key: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          location_id?: string
          permission_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alert_config: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_triggered_at: string | null
          min_severity: Database["public"]["Enums"]["security_event_severity"]
          notify_email: string
          scope: string
          tenant_id: string | null
          threshold_per_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_triggered_at?: string | null
          min_severity?: Database["public"]["Enums"]["security_event_severity"]
          notify_email: string
          scope?: string
          tenant_id?: string | null
          threshold_per_hour?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_triggered_at?: string | null
          min_severity?: Database["public"]["Enums"]["security_event_severity"]
          notify_email?: string
          scope?: string
          tenant_id?: string | null
          threshold_per_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alert_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          occurred_at: string
          request_path: string | null
          severity: Database["public"]["Enums"]["security_event_severity"]
          source: string
          target_resource: string | null
          target_table: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          occurred_at?: string
          request_path?: string | null
          severity?: Database["public"]["Enums"]["security_event_severity"]
          source?: string
          target_resource?: string | null
          target_table?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          occurred_at?: string
          request_path?: string | null
          severity?: Database["public"]["Enums"]["security_event_severity"]
          source?: string
          target_resource?: string | null
          target_table?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stock_counts: {
        Row: {
          adjustment_reason: string | null
          count_session_id: string
          counted_by: string | null
          created_at: string
          difference: number
          difference_pct: number
          id: string
          inventory_item_id: string
          location_id: string
          physical_count: number
          system_stock: number
        }
        Insert: {
          adjustment_reason?: string | null
          count_session_id: string
          counted_by?: string | null
          created_at?: string
          difference?: number
          difference_pct?: number
          id?: string
          inventory_item_id: string
          location_id: string
          physical_count?: number
          system_stock?: number
        }
        Update: {
          adjustment_reason?: string | null
          count_session_id?: string
          counted_by?: string | null
          created_at?: string
          difference?: number
          difference_pct?: number
          id?: string
          inventory_item_id?: string
          location_id?: string
          physical_count?: number
          system_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_intakes: {
        Row: {
          created_at: string
          delivery_date: string
          employee_name: string | null
          id: string
          inventory_item_id: string
          invoice_reference: string | null
          location: string | null
          location_id: string
          purchase_price: number
          quantity: number
          supplier: string | null
          unit: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string
          employee_name?: string | null
          id?: string
          inventory_item_id: string
          invoice_reference?: string | null
          location?: string | null
          location_id: string
          purchase_price?: number
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Update: {
          created_at?: string
          delivery_date?: string
          employee_name?: string | null
          id?: string
          inventory_item_id?: string
          invoice_reference?: string | null
          location?: string | null
          location_id?: string
          purchase_price?: number
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_intakes_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_intakes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          employee_id: string | null
          employee_name: string | null
          id: string
          idempotency_key: string | null
          inventory_item_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          order_id: string | null
          product_sold: string | null
          quantity: number
          source: string | null
          tenant_id: string | null
          waste_reason: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_item_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          order_id?: string | null
          product_sold?: string | null
          quantity?: number
          source?: string | null
          tenant_id?: string | null
          waste_reason?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_item_id?: string
          location_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          order_id?: string | null
          product_sold?: string | null
          quantity?: number
          source?: string | null
          tenant_id?: string | null
          waste_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          custom_overrides: Json
          environment: string
          id: string
          location_id: string
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          price_cents: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_overrides?: Json
          environment?: string
          id?: string
          location_id: string
          plan_type?: Database["public"]["Enums"]["subscription_plan"]
          price_cents?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_overrides?: Json
          environment?: string
          id?: string
          location_id?: string
          plan_type?: Database["public"]["Enums"]["subscription_plan"]
          price_cents?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_feature_flags: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          owner_user_id: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          owner_user_id: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_user_id?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_name: string
          device_token: string
          id: string
          last_ip: string | null
          last_seen_at: string | null
          location_id: string
          paired_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          tenant_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_name: string
          device_token?: string
          id?: string
          last_ip?: string | null
          last_seen_at?: string | null
          location_id: string
          paired_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_name?: string
          device_token?: string
          id?: string
          last_ip?: string | null
          last_seen_at?: string | null
          location_id?: string
          paired_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trusted_devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_devices_paired_by_fkey"
            columns: ["paired_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_devices_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_rules: {
        Row: {
          active_from: string | null
          active_until: string | null
          conversion_count: number
          created_at: string
          extra_price_override: number | null
          id: string
          impression_count: number
          is_active: boolean
          location_id: string
          priority: number
          prompt_text_nl: string
          suggested_product_id: string
          suggestion_type: string
          trigger_category: string | null
          trigger_product_id: string | null
          updated_at: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          conversion_count?: number
          created_at?: string
          extra_price_override?: number | null
          id?: string
          impression_count?: number
          is_active?: boolean
          location_id: string
          priority?: number
          prompt_text_nl?: string
          suggested_product_id: string
          suggestion_type?: string
          trigger_category?: string | null
          trigger_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          conversion_count?: number
          created_at?: string
          extra_price_override?: number | null
          id?: string
          impression_count?: number
          is_active?: boolean
          location_id?: string
          priority?: number
          prompt_text_nl?: string
          suggested_product_id?: string
          suggestion_type?: string
          trigger_category?: string | null
          trigger_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_category_rates: {
        Row: {
          category: string
          created_at: string
          id: string
          location_id: string
          rate: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          location_id: string
          rate: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          location_id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vat_category_rates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_business_correlations: {
        Row: {
          avg_omzet: number | null
          avg_orders: number | null
          category: string
          confidence_score: number
          created_at: string
          id: string
          last_updated: string
          location_id: string
          metadata: Json | null
          pattern_key: string
          sample_size: number
          scope: string
          uplift_percent: number
        }
        Insert: {
          avg_omzet?: number | null
          avg_orders?: number | null
          category?: string
          confidence_score?: number
          created_at?: string
          id?: string
          last_updated?: string
          location_id: string
          metadata?: Json | null
          pattern_key: string
          sample_size?: number
          scope?: string
          uplift_percent?: number
        }
        Update: {
          avg_omzet?: number | null
          avg_orders?: number | null
          category?: string
          confidence_score?: number
          created_at?: string
          id?: string
          last_updated?: string
          location_id?: string
          metadata?: Json | null
          pattern_key?: string
          sample_size?: number
          scope?: string
          uplift_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "weather_business_correlations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_daily_observations: {
        Row: {
          avg_temp_c: number | null
          cloud_cover: number | null
          condition_code: string | null
          condition_label: string | null
          created_at: string
          date: string
          humidity: number | null
          id: string
          is_rain: boolean | null
          is_severe: boolean | null
          is_storm: boolean | null
          location_id: string
          location_key: string
          max_temp_c: number | null
          min_temp_c: number | null
          precipitation_chance: number | null
          pressure: number | null
          raw_payload: Json | null
          source: string
          sunrise_time: string | null
          sunset_time: string | null
          updated_at: string
          uv_index: number | null
          visibility: number | null
          wind_speed: number | null
        }
        Insert: {
          avg_temp_c?: number | null
          cloud_cover?: number | null
          condition_code?: string | null
          condition_label?: string | null
          created_at?: string
          date: string
          humidity?: number | null
          id?: string
          is_rain?: boolean | null
          is_severe?: boolean | null
          is_storm?: boolean | null
          location_id: string
          location_key?: string
          max_temp_c?: number | null
          min_temp_c?: number | null
          precipitation_chance?: number | null
          pressure?: number | null
          raw_payload?: Json | null
          source?: string
          sunrise_time?: string | null
          sunset_time?: string | null
          updated_at?: string
          uv_index?: number | null
          visibility?: number | null
          wind_speed?: number | null
        }
        Update: {
          avg_temp_c?: number | null
          cloud_cover?: number | null
          condition_code?: string | null
          condition_label?: string | null
          created_at?: string
          date?: string
          humidity?: number | null
          id?: string
          is_rain?: boolean | null
          is_severe?: boolean | null
          is_storm?: boolean | null
          location_id?: string
          location_key?: string
          max_temp_c?: number | null
          min_temp_c?: number | null
          precipitation_chance?: number | null
          pressure?: number | null
          raw_payload?: Json | null
          source?: string
          sunrise_time?: string | null
          sunset_time?: string | null
          updated_at?: string
          uv_index?: number | null
          visibility?: number | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_daily_observations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_hourly_observations: {
        Row: {
          cloud_cover: number | null
          condition_code: string | null
          condition_label: string | null
          created_at: string
          date: string
          datetime_hour: string
          feels_like_c: number | null
          humidity: number | null
          id: string
          is_daylight: boolean | null
          local_hour: number
          location_id: string
          location_key: string
          precipitation_chance: number | null
          precipitation_intensity: number | null
          pressure: number | null
          raw_payload: Json | null
          temperature_c: number | null
          updated_at: string
          uv_index: number | null
          visibility: number | null
          wind_speed: number | null
        }
        Insert: {
          cloud_cover?: number | null
          condition_code?: string | null
          condition_label?: string | null
          created_at?: string
          date: string
          datetime_hour: string
          feels_like_c?: number | null
          humidity?: number | null
          id?: string
          is_daylight?: boolean | null
          local_hour: number
          location_id: string
          location_key?: string
          precipitation_chance?: number | null
          precipitation_intensity?: number | null
          pressure?: number | null
          raw_payload?: Json | null
          temperature_c?: number | null
          updated_at?: string
          uv_index?: number | null
          visibility?: number | null
          wind_speed?: number | null
        }
        Update: {
          cloud_cover?: number | null
          condition_code?: string | null
          condition_label?: string | null
          created_at?: string
          date?: string
          datetime_hour?: string
          feels_like_c?: number | null
          humidity?: number | null
          id?: string
          is_daylight?: boolean | null
          local_hour?: number
          location_id?: string
          location_key?: string
          precipitation_chance?: number | null
          precipitation_intensity?: number | null
          pressure?: number | null
          raw_payload?: Json | null
          temperature_c?: number | null
          updated_at?: string
          uv_index?: number | null
          visibility?: number | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_hourly_observations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      customer_current_tier: { Args: { _customer_id: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_device_context: {
        Args: { _token: string }
        Returns: {
          device_id: string
          location_id: string
          tenant_id: string
        }[]
      }
      get_employee_location_id: { Args: { _user_id: string }; Returns: string }
      get_employee_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["employee_role"]
      }
      get_modifier_group_location: {
        Args: { _group_id: string }
        Returns: string
      }
      get_tenant_id_for_user: { Args: { _user_id: string }; Returns: string }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_slug_available: { Args: { _slug: string }; Returns: boolean }
      location_has_active_subscription: {
        Args: { _location_id: string }
        Returns: boolean
      }
      location_in_user_tenant: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _error_code?: string
          _error_message?: string
          _event_type: string
          _ip_address?: string
          _metadata?: Json
          _request_path?: string
          _severity?: Database["public"]["Enums"]["security_event_severity"]
          _source?: string
          _target_resource?: string
          _target_table?: string
          _user_agent?: string
        }
        Returns: string
      }
      modifier_group_in_user_tenant: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      report_pnl: {
        Args: {
          _end: string
          _location_id: string
          _start: string
          _vat_rate?: number
        }
        Returns: Json
      }
      security_events_summary: {
        Args: { _since?: string }
        Returns: {
          critical: number
          cross_tenant: number
          info: number
          rls_rejects: number
          total: number
          unique_tenants: number
          unique_users: number
          warning: number
        }[]
      }
      seed_demo_data: { Args: { _location_id: string }; Returns: Json }
      segment_match_query: {
        Args: { _definition: Json; _tenant_id: string }
        Returns: {
          customer_id: string
        }[]
      }
      segment_preview: { Args: { _segment_id: string }; Returns: Json }
      setup_tenant_onboarding:
        | {
            Args: {
              _address?: string
              _city?: string
              _currency?: string
              _owner_name: string
              _slug: string
              _tenant_name: string
              _timezone?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _address?: string
              _city?: string
              _currency?: string
              _owner_name: string
              _plan_type?: string
              _slug: string
              _tenant_name: string
              _timezone?: string
            }
            Returns: Json
          }
      tenant_has_active_subscription: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      employee_role: "owner" | "manager" | "cashier" | "staff" | "sales"
      inventory_category:
        | "ingredient"
        | "packaging"
        | "pastry"
        | "retail"
        | "cleaning"
        | "misc"
      movement_type:
        | "sale_deduction"
        | "stock_intake"
        | "manual_correction"
        | "waste"
        | "count_adjustment"
        | "refund_restore"
      security_event_severity: "info" | "warning" | "critical"
      subscription_plan: "all_in" | "custom" | "trial" | "pro" | "scale"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "canceled"
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
      employee_role: ["owner", "manager", "cashier", "staff", "sales"],
      inventory_category: [
        "ingredient",
        "packaging",
        "pastry",
        "retail",
        "cleaning",
        "misc",
      ],
      movement_type: [
        "sale_deduction",
        "stock_intake",
        "manual_correction",
        "waste",
        "count_adjustment",
        "refund_restore",
      ],
      security_event_severity: ["info", "warning", "critical"],
      subscription_plan: ["all_in", "custom", "trial", "pro", "scale"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "canceled",
      ],
    },
  },
} as const
