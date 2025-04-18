export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          aluminum_wire: string | null
          capacity: number | null
          company: string | null
          component_outbound_date: string | null
          component_status: string | null
          construction_acceptance_date: string | null
          construction_status: string | null
          construction_team: string | null
          construction_team_phone: string | null
          copper_wire: string | null
          created_at: string | null
          customer_name: string
          deleted_at: string | null
          designer: string | null
          dispatch_date: string | null
          distribution_box: string | null
          drawing_change: string | null
          filing_date: string | null
          id: string
          id_card: string
          inverter: string | null
          investment_amount: number | null
          land_area: number | null
          main_line: string | null
          meter_installation_date: string | null
          meter_number: string | null
          module_count: number
          phone: string
          power_purchase_contract: string | null
          price: number | null
          register_date: string
          remarks: string | null
          salesman: string
          salesman_phone: string | null
          square_steel_outbound_date: string | null
          square_steel_status: string | null
          station_management: string[] | null
          status: string | null
          technical_review: string | null
          updated_at: string | null
          upload_to_grid: string | null
          urge_order: string | null
        }
        Insert: {
          address: string
          aluminum_wire?: string | null
          capacity?: number | null
          company?: string | null
          component_outbound_date?: string | null
          component_status?: string | null
          construction_acceptance_date?: string | null
          construction_status?: string | null
          construction_team?: string | null
          construction_team_phone?: string | null
          copper_wire?: string | null
          created_at?: string | null
          customer_name: string
          deleted_at?: string | null
          designer?: string | null
          dispatch_date?: string | null
          distribution_box?: string | null
          drawing_change?: string | null
          filing_date?: string | null
          id?: string
          id_card: string
          inverter?: string | null
          investment_amount?: number | null
          land_area?: number | null
          main_line?: string | null
          meter_installation_date?: string | null
          meter_number?: string | null
          module_count: number
          phone: string
          power_purchase_contract?: string | null
          price?: number | null
          register_date: string
          remarks?: string | null
          salesman: string
          salesman_phone?: string | null
          square_steel_outbound_date?: string | null
          square_steel_status?: string | null
          station_management?: string[] | null
          status?: string | null
          technical_review?: string | null
          updated_at?: string | null
          upload_to_grid?: string | null
          urge_order?: string | null
        }
        Update: {
          address?: string
          aluminum_wire?: string | null
          capacity?: number | null
          company?: string | null
          component_outbound_date?: string | null
          component_status?: string | null
          construction_acceptance_date?: string | null
          construction_status?: string | null
          construction_team?: string | null
          construction_team_phone?: string | null
          copper_wire?: string | null
          created_at?: string | null
          customer_name?: string
          deleted_at?: string | null
          designer?: string | null
          dispatch_date?: string | null
          distribution_box?: string | null
          drawing_change?: string | null
          filing_date?: string | null
          id?: string
          id_card?: string
          inverter?: string | null
          investment_amount?: number | null
          land_area?: number | null
          main_line?: string | null
          meter_installation_date?: string | null
          meter_number?: string | null
          module_count?: number
          phone?: string
          power_purchase_contract?: string | null
          price?: number | null
          register_date?: string
          remarks?: string | null
          salesman?: string
          salesman_phone?: string | null
          square_steel_outbound_date?: string | null
          square_steel_status?: string | null
          station_management?: string[] | null
          status?: string | null
          technical_review?: string | null
          updated_at?: string | null
          upload_to_grid?: string | null
          urge_order?: string | null
        }
        Relationships: []
      }
      draw_records: {
        Row: {
          construction_team: string
          customer_id: string
          draw_date: string | null
          drawn_by: string
          id: string
          random_code: string
          township: string
        }
        Insert: {
          construction_team: string
          customer_id: string
          draw_date?: string | null
          drawn_by: string
          id?: string
          random_code: string
          township: string
        }
        Update: {
          construction_team?: string
          customer_id?: string
          draw_date?: string | null
          drawn_by?: string
          id?: string
          random_code?: string
          township?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      modification_records: {
        Row: {
          customer_id: string
          field_name: string
          id: string
          modified_at: string | null
          modified_by: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          customer_id: string
          field_name: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          customer_id?: string
          field_name?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modification_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      salesman_relationships: {
        Row: {
          child_id: string
          created_at: string | null
          id: string
          parent_id: string
          updated_at: string | null
        }
        Insert: {
          child_id: string
          created_at?: string | null
          id?: string
          parent_id: string
          updated_at?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string | null
          id?: string
          parent_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          parent_id: string | null
          phone: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          parent_id?: string | null
          phone?: string | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          parent_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_salesman_subordinates: {
        Row: {
          email: string | null
          id: string | null
          name: string | null
          parent_id: string | null
          phone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_salesman: {
        Args: {
          new_salesman_id: string
          manager_id?: string
          assigned_role?: string
        }
        Returns: string
      }
      add_salesman_relationship: {
        Args: {
          manager_id: string
          new_salesman_id: string
        }
        Returns: boolean
      }
      add_user_metadata: {
        Args: {
          user_id: string
          metadata: Json
        }
        Returns: undefined
      }
      assign_role: {
        Args: {
          user_id: string
          role_name: string
        }
        Returns: boolean
      }
      assign_user_role: {
        Args: {
          target_user_id: string
          role_name: string
          is_superior?: boolean
          superior_id?: string
        }
        Returns: Json
      }
      exec_sql: {
        Args: {
          sql_query: string
        }
        Returns: Json
      }
      execute_sql: {
        Args: {
          sql_query: string
        }
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_subordinate_salesmen: {
        Args: {
          p_user_id: string
        }
        Returns: {
          salesman_name: string
        }[]
      }
      get_subordinates: {
        Args: {
          manager_uuid: string
        }
        Returns: {
          subordinate_id: string
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      initialize_admin_role: {
        Args: {
          admin_email: string
          initialize_code: string
        }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_construction_team: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_db_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_filing_officer: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_grid_connector: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_salesman: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_warehouse: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      manage_salesman_relationship: {
        Args: {
          operation: string
          superior_id: string
          subordinate_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
