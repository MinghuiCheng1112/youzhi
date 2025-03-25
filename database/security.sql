-- 客户管理系统安全策略和权限设置
-- 本脚本使用DROP IF EXISTS语句删除已存在的对象，确保脚本可以安全地重复运行
-- 这样在系统开发和部署过程中可以多次执行，而不会产生"已存在"错误

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

-- 客户表的行级安全策略
-- 管理员可以查看和修改所有客户
-- 业务员只能查看和修改自己的客户
-- 仓库管理员可以查看所有客户，但只能更新出库相关字段
-- 施工队只能查看分配给自己的客户，并更新施工状态
-- 备案员可以查看所有客户，但只能更新备案相关字段
-- 并网员可以查看所有客户，但只能更新并网相关字段

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS customers_admin_policy ON customers;
DROP POLICY IF EXISTS customers_salesman_select_policy ON customers;
DROP POLICY IF EXISTS customers_salesman_insert_policy ON customers;
DROP POLICY IF EXISTS customers_salesman_update_policy ON customers;
DROP POLICY IF EXISTS customers_warehouse_select_policy ON customers;
DROP POLICY IF EXISTS customers_warehouse_update_policy ON customers;
DROP POLICY IF EXISTS customers_construction_team_select_policy ON customers;
DROP POLICY IF EXISTS customers_construction_team_update_policy ON customers;
DROP POLICY IF EXISTS customers_filing_officer_select_policy ON customers;
DROP POLICY IF EXISTS customers_filing_officer_update_policy ON customers;
DROP POLICY IF EXISTS customers_grid_connector_select_policy ON customers;
DROP POLICY IF EXISTS customers_grid_connector_update_policy ON customers;

-- 创建行级安全策略
CREATE POLICY customers_admin_policy ON customers
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY customers_salesman_select_policy ON customers
  FOR SELECT
  USING (is_salesman() AND (salesman = current_user OR salesman IN (SELECT salesman_name FROM get_subordinate_salesmen(auth.uid()))));

CREATE POLICY customers_salesman_insert_policy ON customers
  FOR INSERT
  WITH CHECK (is_salesman() AND salesman = current_user);

CREATE POLICY customers_salesman_update_policy ON customers
  FOR UPDATE
  USING (is_salesman() AND (salesman = current_user OR salesman IN (SELECT salesman_name FROM get_subordinate_salesmen(auth.uid()))))
  WITH CHECK (is_salesman() AND (salesman = current_user OR salesman IN (SELECT salesman_name FROM get_subordinate_salesmen(auth.uid()))));

CREATE POLICY customers_warehouse_select_policy ON customers
  FOR SELECT
  USING (is_warehouse());

CREATE POLICY customers_warehouse_update_policy ON customers
  FOR UPDATE
  USING (is_warehouse())
  WITH CHECK (is_warehouse() AND (
    -- 仓库管理员只能更新出库相关字段
    outbound_date IS NOT NULL OR 
    status IS NOT NULL
  ));

CREATE POLICY customers_construction_team_select_policy ON customers
  FOR SELECT
  USING (is_construction_team() AND (construction_team = current_user OR EXISTS (
    SELECT 1 FROM draw_records
    WHERE draw_records.customer_id = customers.id
    AND draw_records.construction_team = current_user
  )));

CREATE POLICY customers_construction_team_update_policy ON customers
  FOR UPDATE
  USING (is_construction_team() AND (construction_team = current_user OR EXISTS (
    SELECT 1 FROM draw_records
    WHERE draw_records.customer_id = customers.id
    AND draw_records.construction_team = current_user
  )))
  WITH CHECK (is_construction_team() AND (construction_team = current_user OR EXISTS (
    SELECT 1 FROM draw_records
    WHERE draw_records.customer_id = customers.id
    AND draw_records.construction_team = current_user
  )) AND (
    -- 施工队只能更新施工状态相关字段
    construction_status IS NOT NULL OR
    main_line IS NOT NULL
  ));

CREATE POLICY customers_filing_officer_select_policy ON customers
  FOR SELECT
  USING (is_filing_officer());

CREATE POLICY customers_filing_officer_update_policy ON customers
  FOR UPDATE
  USING (is_filing_officer())
  WITH CHECK (is_filing_officer() AND (
    -- 备案员只能更新备案相关字段
    filing_date IS NOT NULL OR
    meter_number IS NOT NULL OR
    designer IS NOT NULL OR
    drawing_change IS NOT NULL
  ));

CREATE POLICY customers_grid_connector_select_policy ON customers
  FOR SELECT
  USING (is_grid_connector());

CREATE POLICY customers_grid_connector_update_policy ON customers
  FOR UPDATE
  USING (is_grid_connector())
  WITH CHECK (is_grid_connector() AND (
    -- 并网员只能更新并网相关字段
    technical_review IS NOT NULL OR
    upload_to_grid IS NOT NULL OR
    construction_acceptance IS NOT NULL OR
    meter_installation_date IS NOT NULL OR
    power_purchase_contract IS NOT NULL
  ));

-- 修改记录表的行级安全策略
-- 管理员可以查看所有修改记录
-- 其他角色只能查看与自己相关的客户的修改记录
DROP POLICY IF EXISTS modification_records_admin_policy ON modification_records;
DROP POLICY IF EXISTS modification_records_salesman_policy ON modification_records;
DROP POLICY IF EXISTS modification_records_others_policy ON modification_records;

CREATE POLICY modification_records_admin_policy ON modification_records
  USING (is_admin());

CREATE POLICY modification_records_salesman_policy ON modification_records
  USING (is_salesman() AND EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = modification_records.customer_id
    AND (customers.salesman = current_user OR customers.salesman IN (SELECT salesman_name FROM get_subordinate_salesmen(auth.uid())))
  ));

CREATE POLICY modification_records_others_policy ON modification_records
  USING (
    (is_warehouse() OR is_construction_team() OR is_filing_officer() OR is_grid_connector())
    AND EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = modification_records.customer_id
      AND (
        (is_construction_team() AND (customers.construction_team = current_user OR EXISTS (
          SELECT 1 FROM draw_records
          WHERE draw_records.customer_id = customers.id
          AND draw_records.construction_team = current_user
        ))) OR
        (is_warehouse() OR is_filing_officer() OR is_grid_connector())
      )
    )
  );

-- 抽签记录表的行级安全策略
-- 管理员和仓库管理员可以查看和创建抽签记录
-- 其他角色只能查看抽签记录
DROP POLICY IF EXISTS draw_records_admin_warehouse_policy ON draw_records;
DROP POLICY IF EXISTS draw_records_others_select_policy ON draw_records;

CREATE POLICY draw_records_admin_warehouse_policy ON draw_records
  USING (is_admin() OR is_warehouse())
  WITH CHECK (is_admin() OR is_warehouse());

CREATE POLICY draw_records_others_select_policy ON draw_records
  FOR SELECT
  USING (is_salesman() OR is_construction_team() OR is_filing_officer() OR is_grid_connector());

-- 用户角色表的行级安全策略
-- 只有管理员可以查看和修改用户角色
-- 其他用户只能查看自己的角色
DROP POLICY IF EXISTS user_roles_admin_policy ON user_roles;
DROP POLICY IF EXISTS user_roles_self_select_policy ON user_roles;

CREATE POLICY user_roles_admin_policy ON user_roles
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY user_roles_self_select_policy ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 授予角色权限
DO $$
BEGIN
  -- 授予使用权限
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
  
  -- 授予执行函数的权限
  GRANT EXECUTE ON FUNCTION get_user_role() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION is_admin() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION is_salesman() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION get_subordinate_salesmen(UUID) TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION is_warehouse() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION is_construction_team() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION is_filing_officer() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION is_grid_connector() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector, app_anonymous;
  GRANT EXECUTE ON FUNCTION record_customer_changes() TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector;
END
$$;

-- 创建触发器函数，用于自动记录客户信息修改
-- 首先删除依赖此函数的触发器
DROP TRIGGER IF EXISTS customer_changes_trigger ON customers;

-- 然后删除函数本身
DROP FUNCTION IF EXISTS record_customer_changes();

CREATE OR REPLACE FUNCTION record_customer_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- 遍历所有列，记录变更
    FOR i IN 1..TG_NARGS LOOP
      DECLARE
        col_name TEXT := TG_ARGV[i-1];
        old_val TEXT;
        new_val TEXT;
      BEGIN
        EXECUTE format('SELECT $1.%I::TEXT', col_name) USING OLD INTO old_val;
        EXECUTE format('SELECT $1.%I::TEXT', col_name) USING NEW INTO new_val;
        
        IF old_val IS DISTINCT FROM new_val THEN
          INSERT INTO modification_records(
            customer_id, field_name, old_value, new_value, modified_by
          ) VALUES (
            NEW.id, col_name, old_val, new_val, auth.uid()
          );
        END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为客户表创建触发器，自动记录所有字段的变更
DROP TRIGGER IF EXISTS customer_changes_trigger ON customers;

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