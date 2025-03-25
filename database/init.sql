-- 客户管理系统数据库初始化脚本
-- 包含所有表结构定义和权限设置

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== 表结构定义 ====================

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
  drawing_change BOOLEAN DEFAULT false,
  urge_order TEXT,
  capacity NUMERIC(10, 2),
  investment_amount NUMERIC(10, 2),
  land_area NUMERIC(10, 2),
  module_count INTEGER NOT NULL,
  inverter TEXT,
  copper_wire TEXT,
  aluminum_wire TEXT,
  distribution_box TEXT,
  outbound_date TIMESTAMP WITH TIME ZONE,
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
CREATE INDEX IF NOT EXISTS idx_customers_salesman ON customers(salesman);
CREATE INDEX IF NOT EXISTS idx_customers_construction_status ON customers(construction_status);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_outbound_date ON customers(outbound_date);
CREATE INDEX IF NOT EXISTS idx_customers_dispatch_date ON customers(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_modification_records_customer_id ON modification_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_draw_records_customer_id ON draw_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_salesman_relationships_parent_id ON salesman_relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_salesman_relationships_child_id ON salesman_relationships(child_id);

-- ==================== 安全策略和权限设置 ====================

-- 启用行级安全策略
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 创建应用角色
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_filing_officer') THEN
    CREATE ROLE app_filing_officer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_salesman') THEN
    CREATE ROLE app_salesman;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_warehouse') THEN
    CREATE ROLE app_warehouse;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_construction_team') THEN
    CREATE ROLE app_construction_team;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_grid_connector') THEN
    CREATE ROLE app_grid_connector;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_anonymous') THEN
    CREATE ROLE app_anonymous;
  END IF;
END
$$;

-- 创建获取当前用户角色的函数
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM user_roles WHERE user_id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户是否为管理员的函数
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户是否为业务员的函数
CREATE OR REPLACE FUNCTION is_salesman()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'salesman';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建获取业务员下级业务员的函数
CREATE OR REPLACE FUNCTION get_subordinate_salesmen(p_user_id UUID)
RETURNS TABLE (salesman_name TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinates AS (
    -- 起始用户
    SELECT ur.user_id, u.email as salesman_name
    FROM user_roles ur
    JOIN auth.users u ON ur.user_id = u.id
    WHERE ur.user_id = p_user_id
    
    UNION ALL
    
    -- 递归查找所有下级
    SELECT ur.user_id, u.email as salesman_name
    FROM user_roles ur
    JOIN auth.users u ON ur.user_id = u.id
    JOIN subordinates s ON ur.parent_id = s.user_id
  )
  SELECT salesman_name FROM subordinates WHERE user_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户是否为仓库管理员的函数
CREATE OR REPLACE FUNCTION is_warehouse()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'warehouse';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户是否为施工队的函数
CREATE OR REPLACE FUNCTION is_construction_team()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'construction_team';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户是否为备案员的函数
CREATE OR REPLACE FUNCTION is_filing_officer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'filing_officer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户是否为并网员的函数
CREATE OR REPLACE FUNCTION is_grid_connector()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'grid_connector';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 行级安全策略 ====================

-- 客户表的行级安全策略
-- 管理员可以查看和修改所有客户
-- 业务员只能查看和修改自己的客户
-- 仓库管理员可以查看所有客户，但只能更新出库相关字段
-- 施工队只能查看分配给自己的客户，并更新施工状态
-- 备案员可以查看所有客户，但只能更新备案相关字段
-- 并网员可以查看所有客户，但只能更新并网相关字段
CREATE POLICY customers_admin_policy ON customers
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY customers_salesman_select_policy ON customers
  FOR SELECT
  USING (is_salesman() AND salesman = current_user);

CREATE POLICY customers_salesman_insert_policy ON customers
  FOR INSERT
  WITH CHECK (is_salesman() AND salesman = current_user);

CREATE POLICY customers_salesman_update_policy ON customers
  FOR UPDATE
  USING (is_salesman() AND salesman = current_user)
  WITH CHECK (is_salesman() AND salesman = current_user);

CREATE POLICY customers_warehouse_select_policy ON customers
  FOR SELECT
  USING (is_warehouse());

CREATE POLICY customers_warehouse_update_policy ON customers
  FOR UPDATE
  USING (is_warehouse());

CREATE POLICY customers_construction_team_select_policy ON customers
  FOR SELECT
  USING (is_construction_team() AND construction_team = current_user);

CREATE POLICY customers_construction_team_update_policy ON customers
  FOR UPDATE
  USING (is_construction_team() AND construction_team = current_user)
  WITH CHECK (is_construction_team() AND construction_team = current_user);

CREATE POLICY customers_filing_officer_select_policy ON customers
  FOR SELECT
  USING (is_filing_officer());

CREATE POLICY customers_filing_officer_update_policy ON customers
  FOR UPDATE
  USING (is_filing_officer());

CREATE POLICY customers_grid_connector_select_policy ON customers
  FOR SELECT
  USING (is_grid_connector());

CREATE POLICY customers_grid_connector_update_policy ON customers
  FOR UPDATE
  USING (is_grid_connector());

-- 修改记录表的行级安全策略
-- 管理员可以查看所有修改记录
-- 其他角色只能查看与自己相关的客户的修改记录
CREATE POLICY modification_records_admin_policy ON modification_records
  USING (is_admin());

CREATE POLICY modification_records_salesman_policy ON modification_records
  USING (is_salesman() AND EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = modification_records.customer_id
    AND customers.salesman = current_user
  ));

CREATE POLICY modification_records_others_policy ON modification_records
  USING (
    (is_warehouse() OR is_construction_team() OR is_filing_officer() OR is_grid_connector())
    AND EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = modification_records.customer_id
      AND (
        (is_construction_team() AND customers.construction_team = current_user) OR
        (is_warehouse() OR is_filing_officer() OR is_grid_connector())
      )
    )
  );

-- 抽签记录表的行级安全策略
-- 管理员和仓库管理员可以查看和创建抽签记录
-- 其他角色只能查看抽签记录
CREATE POLICY draw_records_admin_warehouse_policy ON draw_records
  USING (is_admin() OR is_warehouse())
  WITH CHECK (is_admin() OR is_warehouse());

CREATE POLICY draw_records_others_select_policy ON draw_records
  FOR SELECT
  USING (is_salesman() OR is_construction_team() OR is_filing_officer() OR is_grid_connector());

-- 用户角色表的行级安全策略
-- 只有管理员可以查看和修改用户角色
-- 其他用户只能查看自己的角色
CREATE POLICY user_roles_admin_policy ON user_roles
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY user_roles_self_select_policy ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 业务员关系表的行级安全策略
-- 管理员可以查看和修改所有关系
-- 业务员只能查看和修改与自己相关的下级关系
ALTER TABLE salesman_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY salesman_relationships_admin_policy ON salesman_relationships
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY salesman_relationships_parent_policy ON salesman_relationships
  USING (is_salesman() AND parent_id = auth.uid())
  WITH CHECK (is_salesman() AND parent_id = auth.uid());

CREATE POLICY salesman_relationships_view_policy ON salesman_relationships
  FOR SELECT
  USING (is_salesman() AND (parent_id = auth.uid() OR child_id = auth.uid()));

-- ==================== 角色权限授予 ====================

-- 授予角色权限
GRANT USAGE ON SCHEMA public TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;

-- 管理员拥有所有表的所有权限
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;

-- 业务员权限
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO app_salesman;
GRANT SELECT ON modification_records TO app_salesman;
GRANT SELECT ON draw_records TO app_salesman;
GRANT SELECT, INSERT, UPDATE, DELETE ON salesman_relationships TO app_salesman;

-- 仓库管理员权限
GRANT SELECT, UPDATE ON customers TO app_warehouse;
GRANT SELECT ON modification_records TO app_warehouse;
GRANT SELECT, INSERT ON draw_records TO app_warehouse;

-- 施工队权限
GRANT SELECT, UPDATE ON customers TO app_construction_team;
GRANT SELECT ON modification_records TO app_construction_team;
GRANT SELECT ON draw_records TO app_construction_team;

-- 备案员权限
GRANT SELECT, UPDATE ON customers TO app_filing_officer;
GRANT SELECT ON modification_records TO app_filing_officer;
GRANT SELECT ON draw_records TO app_filing_officer;

-- 并网员权限
GRANT SELECT, UPDATE ON customers TO app_grid_connector;
GRANT SELECT ON modification_records TO app_grid_connector;
GRANT SELECT ON draw_records TO app_grid_connector;

-- 匿名用户权限（最小权限）
GRANT SELECT ON user_roles TO app_anonymous;

-- ==================== 触发器函数 ====================

-- 创建触发器函数，用于自动记录客户信息修改
CREATE OR REPLACE FUNCTION record_customer_changes()
RETURNS TRIGGER AS $$
DECLARE
  col_name TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- 遍历所有列，记录变更
    FOR i IN 1..TG_NARGS LOOP
      col_name := TG_ARGV[i-1];
      
      EXECUTE format('SELECT $1.%I::TEXT', col_name) USING OLD INTO old_val;
      EXECUTE format('SELECT $1.%I::TEXT', col_name) USING NEW INTO new_val;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO modification_records(
          customer_id, field_name, old_value, new_value, modified_by
        ) VALUES (
          NEW.id, col_name, old_val, new_val, auth.uid()
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为客户表创建触发器，自动记录所有字段的变更
CREATE TRIGGER customer_changes_trigger
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_customer_changes(
  'customer_name', 'phone', 'address', 'id_card', 'salesman', 'salesman_phone',
  'station_management', 'filing_date', 'meter_number', 'designer', 'drawing_change',
  'urge_order', 'capacity', 'investment_amount', 'land_area', 'module_count',
  'inverter', 'copper_wire', 'aluminum_wire', 'distribution_box', 'outbound_date',
  'dispatch_date', 'construction_team', 'construction_team_phone', 'construction_status',
  'main_line', 'technical_review', 'upload_to_grid', 'construction_acceptance',
  'meter_installation_date', 'power_purchase_contract', 'status', 'price', 'company', 'remarks'
);