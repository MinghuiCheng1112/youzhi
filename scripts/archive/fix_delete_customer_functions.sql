-- 修复客户删除相关的触发器函数
-- 解决问题：capture_soft_deleted_customer和record_deleted_customer函数引用了不存在的列

-- 1. 移除现有触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;

-- 2. 移除现有函数
DROP FUNCTION IF EXISTS capture_soft_deleted_customer();
DROP FUNCTION IF EXISTS record_deleted_customer();

-- 3. 重新创建capture_soft_deleted_customer函数（修复后的版本）
CREATE OR REPLACE FUNCTION capture_soft_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在删除标记从NULL变为非NULL时触发
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- 将删除的客户记录到deleted_records表，只包含表中存在的列
    INSERT INTO deleted_records (
      original_id, customer_name, phone, address, id_card,
      register_date, salesman, salesman_phone,
      station_management, filing_date, meter_number,
      designer, drawing_change, urge_order,
      capacity, investment_amount, land_area, module_count,
      inverter, copper_wire, aluminum_wire, distribution_box,
      square_steel_outbound_date, component_outbound_date,
      dispatch_date, construction_team, construction_team_phone,
      construction_status, main_line, technical_review,
      upload_to_grid, construction_acceptance,
      meter_installation_date, power_purchase_contract,
      status, deleted_at, deleted_by,
      customer_created_at, customer_updated_at,
      technical_review_status, construction_acceptance_status,
      construction_acceptance_waiting_days, construction_acceptance_waiting_start
    ) VALUES (
      NEW.id, NEW.customer_name, NEW.phone, NEW.address, NEW.id_card,
      NEW.register_date, NEW.salesman, NEW.salesman_phone,
      NEW.station_management, NEW.filing_date, NEW.meter_number,
      NEW.designer, NEW.drawing_change, NEW.urge_order,
      NEW.capacity, NEW.investment_amount, NEW.land_area, NEW.module_count,
      NEW.inverter, NEW.copper_wire, NEW.aluminum_wire, NEW.distribution_box,
      NEW.square_steel_outbound_date, NEW.component_outbound_date,
      NEW.dispatch_date, NEW.construction_team, NEW.construction_team_phone,
      NEW.construction_status, NEW.main_line, NEW.technical_review,
      NEW.upload_to_grid, NEW.construction_acceptance,
      NEW.meter_installation_date, NEW.power_purchase_contract,
      NEW.status, NEW.deleted_at, NULL,
      -- 使用NOW()替代created_at和updated_at列
      NOW(), NOW(),
      NEW.technical_review_status, NULL,
      NULL, NEW.construction_acceptance_waiting_start
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 重新创建record_deleted_customer函数（修复后的版本）
CREATE OR REPLACE FUNCTION record_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 将物理删除的客户记录保存到deleted_records表
  INSERT INTO deleted_records (
    original_id, customer_name, phone, address, id_card,
    register_date, salesman, salesman_phone,
    station_management, filing_date, meter_number,
    designer, drawing_change, urge_order,
    capacity, investment_amount, land_area, module_count,
    inverter, copper_wire, aluminum_wire, distribution_box,
    square_steel_outbound_date, component_outbound_date,
    dispatch_date, construction_team, construction_team_phone,
    construction_status, main_line, technical_review,
    upload_to_grid, construction_acceptance,
    meter_installation_date, power_purchase_contract,
    status, deleted_at, deleted_by,
    customer_created_at, customer_updated_at,
    technical_review_status, construction_acceptance_status,
    construction_acceptance_waiting_days, construction_acceptance_waiting_start
  ) VALUES (
    OLD.id, OLD.customer_name, OLD.phone, OLD.address, OLD.id_card,
    OLD.register_date, OLD.salesman, OLD.salesman_phone,
    OLD.station_management, OLD.filing_date, OLD.meter_number,
    OLD.designer, OLD.drawing_change, OLD.urge_order,
    OLD.capacity, OLD.investment_amount, OLD.land_area, OLD.module_count,
    OLD.inverter, OLD.copper_wire, OLD.aluminum_wire, OLD.distribution_box,
    OLD.square_steel_outbound_date, OLD.component_outbound_date,
    OLD.dispatch_date, OLD.construction_team, OLD.construction_team_phone,
    OLD.construction_status, OLD.main_line, OLD.technical_review,
    OLD.upload_to_grid, OLD.construction_acceptance,
    OLD.meter_installation_date, OLD.power_purchase_contract,
    OLD.status, NOW(), NULL,
    -- 使用NOW()替代created_at和updated_at列
    NOW(), NOW(),
    OLD.technical_review_status, NULL,
    NULL, OLD.construction_acceptance_waiting_start
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. 重新添加触发器
CREATE TRIGGER trigger_capture_soft_deleted_customer
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

CREATE TRIGGER trigger_record_deleted_customer
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_deleted_customer();

-- 6. 返回通知
SELECT 'Customer delete trigger functions have been fixed successfully.' AS result; 