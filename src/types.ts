export interface Customer {
  id?: string;
  customer_name: string;
  phone?: string;
  address?: string;
  id_card?: string;
  register_date?: string;
  filing_date?: string | null;
  meter_number?: string;
  designer?: string;
  designer_phone?: string | null;
  drawing_change?: boolean;
  urge_order?: string | null;
  module_count?: number;
  capacity?: number;
  investment_amount?: number;
  land_area?: number;
  inverter?: string;
  inverter_brand?: string;
  inverter_model?: string;
  inverter_serial?: string;
  inverter_outbound_date?: string | null;
  copper_wire?: string;
  copper_wire_outbound_date?: string | null;
  aluminum_wire?: string;
  aluminum_wire_outbound_date?: string | null;
  distribution_box?: string;
  distribution_box_outbound_date?: string | null;
  outbound_date?: string | null;
  square_steel_outbound?: boolean;
  square_steel_status?: 'none' | 'outbound' | 'inbound' | 'returned';
  square_steel_outbound_date?: string | null;
  square_steel_inbound_date?: string | null;
  component_outbound?: boolean;
  component_status?: 'none' | 'outbound' | 'inbound' | 'returned';
  component_outbound_date?: string | null;
  component_inbound_date?: string | null;
  dispatch_date?: string | null;
  construction_team?: string;
  construction_team_phone?: string | null;
  construction_status?: string | null;
  construction_date?: string | null;
  construction_notes?: string;
  town?: string;
  main_line?: string;
  large_cable?: string;
  technical_review?: string | null;
  technical_review_status?: 'pending' | 'approved' | 'rejected';
  technical_review_date?: string | null;
  technical_review_notes?: string | null;
  technical_review_rejected?: string | null;
  upload_to_grid?: string | null;
  construction_acceptance_status?: 'pending' | 'completed';
  construction_acceptance_date?: string | null;
  meter_installation_date?: string | null;
  power_purchase_contract?: string | null;
  status?: string;
  price?: number;
  company?: string;
  remarks?: string;
  station_management?: string | string[];
  salesman?: string;
  salesman_phone?: string;
  salesman_email?: string;
  surveyor?: string;
  surveyor_phone?: string;
  surveyor_email?: string | null;
  created_at?: string;
  updated_at?: string;
  rejection_date?: string | null;
  deleted_at?: string;
  module_count_delivered?: number;
}

export interface ImportResult {
  total: number;
  success: number;
  duplicate: number;
  failed: number;
  failedItems: {
    row: number;
    reason: string;
  }[];
}