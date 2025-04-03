-- 客户管理系统数据库表结构定义

-- 用户角色表
-- 存储系统用户的角色信息
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'filing_officer', 'salesman', 'warehouse', 'construction_team', 'grid_connector')),
  parent_id UUID REFERENCES user_roles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 客户表
-- 存储客户的基本信息和状态
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  register_date TIMESTAMP WITH TIME ZONE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  id_card TEXT NOT NULL,
  salesman TEXT NOT NULL,
  salesman_phone TEXT,
  station_management TEXT[],
  filing_date TIMESTAMP WITH TIME ZONE,
  meter_number TEXT,
  designer TEXT,
  drawing_change TEXT DEFAULT '未出图',
  urge_order TEXT,
  capacity NUMERIC(10, 2),
  investment_amount NUMERIC(10, 2),
  land_area NUMERIC(10, 2),
  module_count INTEGER NOT NULL,
  inverter TEXT,
  copper_wire TEXT,
  aluminum_wire TEXT,
  distribution_box TEXT,
  square_steel_outbound_date TEXT,
  component_outbound_date TEXT,
  dispatch_date TIMESTAMP WITH TIME ZONE,
  construction_team TEXT,
  construction_team_phone TEXT,
  construction_status TEXT,
  main_line TEXT,
  technical_review TEXT,
  upload_to_grid TEXT,
  construction_acceptance TEXT,
  meter_installation_date TIMESTAMP WITH TIME ZONE,
  power_purchase_contract TEXT,
  status TEXT,
  price NUMERIC(10, 2),
  company TEXT CHECK (company IN ('haoChen', 'youZhi')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 修改记录表
-- 记录客户信息的修改历史
CREATE TABLE IF NOT EXISTS modification_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  modified_by UUID NOT NULL REFERENCES auth.users(id),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 抽签记录表
-- 记录客户抽签选择施工队的结果
CREATE TABLE IF NOT EXISTS draw_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  township TEXT NOT NULL,
  random_code TEXT NOT NULL,
  construction_team TEXT NOT NULL,
  draw_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  drawn_by UUID NOT NULL REFERENCES auth.users(id)
);

-- 业务员关系表
-- 记录业务员之间的上下级关系
CREATE TABLE IF NOT EXISTS salesman_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(parent_id, child_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_customers_customer_name ON customers(customer_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_address ON customers(address);
CREATE INDEX IF NOT EXISTS idx_customers_salesman ON customers(salesman);
CREATE INDEX IF NOT EXISTS idx_customers_register_date ON customers(register_date);
CREATE INDEX IF NOT EXISTS idx_customers_dispatch_date ON customers(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_customers_construction_team ON customers(construction_team);
CREATE INDEX IF NOT EXISTS idx_customers_square_steel_outbound_date ON customers(square_steel_outbound_date);
CREATE INDEX IF NOT EXISTS idx_customers_component_outbound_date ON customers(component_outbound_date);
CREATE INDEX IF NOT EXISTS idx_modification_records_customer_id ON modification_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_draw_records_customer_id ON draw_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_salesman_relationships_parent_id ON salesman_relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_salesman_relationships_child_id ON salesman_relationships(child_id);