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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          location_id: string | null
          note_text: string
        }
        Insert: {
          action_type?: string
          cash_closing_id: string
          created_at?: string
          employee_name: string
          id?: string
          location_id?: string | null
          note_text: string
        }
        Update: {
          action_type?: string
          cash_closing_id?: string
          created_at?: string
          employee_name?: string
          id?: string
          location_id?: string | null
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
          location_id: string | null
          primary_employee_id: string
          primary_employee_name: string
          second_checker_id: string
          second_checker_name: string
          status: string
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
          location_id?: string | null
          primary_employee_id: string
          primary_employee_name: string
          second_checker_id: string
          second_checker_name: string
          status?: string
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
          location_id?: string | null
          primary_employee_id?: string
          primary_employee_name?: string
          second_checker_id?: string
          second_checker_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_location_id_fkey"
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
          location_id: string | null
          locked_until: string | null
          role: Database["public"]["Enums"]["employee_role"]
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
          location_id?: string | null
          locked_until?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
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
          location_id?: string | null
          locked_until?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          location_id: string | null
          minimum_stock: number
          recommended_threshold: number
          reorder_level: number
          sku: string | null
          supplier: string | null
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
          location_id?: string | null
          minimum_stock?: number
          recommended_threshold?: number
          reorder_level?: number
          sku?: string | null
          supplier?: string | null
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
          location_id?: string | null
          minimum_stock?: number
          recommended_threshold?: number
          reorder_level?: number
          sku?: string | null
          supplier?: string | null
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
      margin_targets: {
        Row: {
          category: string
          created_at: string
          id: string
          location_id: string | null
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          location_id?: string | null
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          location_id?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          items: Json
          location_id: string | null
          loyalty_id: string | null
          loyalty_provider: string | null
          order_id: string
          payment_method: string
          source: string
          status: string
          subtotal: number
          table_id: string | null
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
          items?: Json
          location_id?: string | null
          loyalty_id?: string | null
          loyalty_provider?: string | null
          order_id: string
          payment_method?: string
          source?: string
          status?: string
          subtotal?: number
          table_id?: string | null
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
          items?: Json
          location_id?: string | null
          loyalty_id?: string | null
          loyalty_provider?: string | null
          order_id?: string
          payment_method?: string
          source?: string
          status?: string
          subtotal?: number
          table_id?: string | null
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
        ]
      }
      product_costs: {
        Row: {
          buying_price: number
          created_at: string | null
          id: string
          location_id: string | null
          product_name: string
          selling_price: number | null
          updated_at: string | null
        }
        Insert: {
          buying_price?: number
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_name: string
          selling_price?: number | null
          updated_at?: string | null
        }
        Update: {
          buying_price?: number
          created_at?: string | null
          id?: string
          location_id?: string | null
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
          location_id: string | null
          modifier_group_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          modifier_group_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
      qr_orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          items: Json
          location_id: string | null
          status: string
          table_id: string
          total: number
        }
        Insert: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          items?: Json
          location_id?: string | null
          status?: string
          table_id: string
          total?: number
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          items?: Json
          location_id?: string | null
          status?: string
          table_id?: string
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
        ]
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          inventory_item_id: string
          location_id: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          order_id: string | null
          product_sold: string | null
          quantity: number
          source: string | null
          waste_reason: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          inventory_item_id: string
          location_id?: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          order_id?: string | null
          product_sold?: string | null
          quantity?: number
          source?: string | null
          waste_reason?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          inventory_item_id?: string
          location_id?: string | null
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          order_id?: string | null
          product_sold?: string | null
          quantity?: number
          source?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
      weather_business_correlations: {
        Row: {
          avg_omzet: number | null
          avg_orders: number | null
          category: string
          confidence_score: number
          created_at: string
          id: string
          last_updated: string
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
      setup_tenant_onboarding: {
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
    }
    Enums: {
      employee_role: "owner" | "manager" | "cashier" | "staff"
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
      employee_role: ["owner", "manager", "cashier", "staff"],
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
    },
  },
} as const
