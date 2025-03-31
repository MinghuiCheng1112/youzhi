export type OutboundStatus = 'none' | 'outbound' | 'inbound' | 'returned';

export interface Customer {
  id: string;
  customer_name: string;
  phone?: string;
  address?: string;
  register_date: string;
  square_steel_outbound_date?: string | null;
  component_outbound_date?: string | null;
  square_steel_inbound_date?: string | null;
  component_inbound_date?: string | null;
  square_steel_status?: OutboundStatus;
  component_status?: OutboundStatus;
  outbound_date?: string | null;
  dispatch_date?: string | null;
  construction_status?: string | null;
  construction_team?: string | null;
  construction_team_phone?: string | null;
  surveyor?: string | null;
  surveyor_phone?: string | null;
  designer?: string | null;
  designer_phone?: string | null;
  salesman?: string | null;
  salesman_phone?: string | null;
  module_count?: number;
  capacity?: number;
  status?: string;
  created_at: string;
  updated_at: string;
  inverter_brand?: string;
  inverter_model?: string;
  inverter_serial?: string;
  main_line?: string;
  construction_notes?: string;
  station_management?: string[] | string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount?: number;
  errors?: string[];
}