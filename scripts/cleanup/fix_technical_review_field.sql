-- 修复客户删除触发器函数中对technical_review字段的引用

-- 首先分析当前函数
SELECT 'Analyzing current functions...' AS step;

-- 1. 检查哪些函数引用了technical_review字段
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('capture_soft_deleted_customer', 'record_deleted_customer', 'restore_deleted_record')
  AND pg_get_functiondef(p.oid) LIKE '%technical_review%';

-- 2. 重新创建capture_soft_deleted_customer函数（确保正确处理technical_review字段）
DROP FUNCTION IF EXISTS capture_soft_deleted_customer() CASCADE;

CREATE OR REPLACE FUNCTION capture_soft_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在删除标记从NULL变为非NULL时触发
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- 将删除的客户记录到deleted_records表，确保technical_review字段处理正确
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
      NEW.construction_status, NEW.main_line, 
      COALESCE(NEW.technical_review, ''), -- 确保技术评审字段不为NULL
      NEW.upload_to_grid, NEW.construction_acceptance,
      NEW.meter_installation_date, NEW.power_purchase_contract,
      NEW.status, NEW.deleted_at, NULL,
      NOW(), NOW(),
      NEW.technical_review_status, NULL,
      NULL, NEW.construction_acceptance_waiting_start
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 重新创建record_deleted_customer函数（确保正确处理technical_review字段）
DROP FUNCTION IF EXISTS record_deleted_customer() CASCADE;

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
    OLD.construction_status, OLD.main_line, 
    COALESCE(OLD.technical_review, ''), -- 确保技术评审字段不为NULL
    OLD.upload_to_grid, OLD.construction_acceptance,
    OLD.meter_installation_date, OLD.power_purchase_contract,
    OLD.status, NOW(), NULL,
    NOW(), NOW(),
    OLD.technical_review_status, NULL,
    NULL, OLD.construction_acceptance_waiting_start
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 4. 重新添加触发器
CREATE TRIGGER trigger_capture_soft_deleted_customer
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

CREATE TRIGGER trigger_record_deleted_customer
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_deleted_customer();

-- 5. 修复restore_deleted_record函数
DROP FUNCTION IF EXISTS restore_deleted_record(uuid) CASCADE;

CREATE OR REPLACE FUNCTION restore_deleted_record(record_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  customer_exists BOOLEAN;
  deleted_record RECORD;
BEGIN
  -- 获取要恢复的已删除记录
  SELECT * INTO deleted_record FROM deleted_records WHERE id = record_id;
  
  IF NOT FOUND THEN
    RETURN '找不到指定的删除记录';
  END IF;

  -- 检查客户ID是否已存在（可能已经被重新创建）
  SELECT EXISTS(
    SELECT 1 FROM customers WHERE id = deleted_record.original_id
  ) INTO customer_exists;

  IF customer_exists THEN
    -- 如果客户ID存在，则更新而不是插入
    UPDATE customers SET
      customer_name = deleted_record.customer_name,
      phone = deleted_record.phone,
      address = deleted_record.address,
      id_card = deleted_record.id_card,
      register_date = deleted_record.register_date,
      salesman = deleted_record.salesman,
      salesman_phone = deleted_record.salesman_phone,
      surveyor = NULL, -- 避免引用可能不存在的字段
      surveyor_phone = NULL, -- 避免引用可能不存在的字段
      designer = deleted_record.designer,
      designer_phone = NULL, -- 使用NULL避免潜在问题
      meter_number = deleted_record.meter_number,
      capacity = deleted_record.capacity,
      investment_amount = deleted_record.investment_amount,
      land_area = deleted_record.land_area,
      module_count = deleted_record.module_count,
      inverter = deleted_record.inverter,
      copper_wire = deleted_record.copper_wire,
      aluminum_wire = deleted_record.aluminum_wire,
      distribution_box = deleted_record.distribution_box,
      square_steel_outbound_date = deleted_record.square_steel_outbound_date,
      component_outbound_date = deleted_record.component_outbound_date,
      dispatch_date = deleted_record.dispatch_date,
      construction_team = deleted_record.construction_team,
      construction_team_phone = deleted_record.construction_team_phone,
      construction_acceptance_date = deleted_record.construction_acceptance_date,
      construction_acceptance_waiting_start = deleted_record.construction_acceptance_waiting_start,  
      meter_installation_date = deleted_record.meter_installation_date,
      power_purchase_contract = deleted_record.power_purchase_contract,
      technical_review = COALESCE(deleted_record.technical_review, ''), -- 确保不为NULL
      technical_review_status = deleted_record.technical_review_status,
      station_management = deleted_record.station_management,
      urge_order = deleted_record.urge_order,
      drawing_change = deleted_record.drawing_change,
      filing_date = deleted_record.filing_date,
      construction_status = deleted_record.construction_status,
      deleted_at = NULL,
      updated_at = NOW()
    WHERE id = deleted_record.original_id;

    -- 将删除记录标记为已恢复
    UPDATE deleted_records
    SET restored_at = NOW(),
        restored_by = NULL
    WHERE id = record_id;

    RETURN '客户已恢复（通过更新现有记录）';
  ELSE
    -- 如果客户ID不存在，则插入新记录 (简化插入，避免使用可能不存在的字段)
    INSERT INTO customers (
      id, customer_name, phone, address, id_card,
      register_date, salesman, salesman_phone,
      designer, meter_number,
      capacity, investment_amount, land_area, module_count,
      inverter, copper_wire, aluminum_wire, distribution_box,
      square_steel_outbound_date, component_outbound_date,
      dispatch_date, construction_team, construction_team_phone,
      construction_acceptance_date, construction_acceptance_waiting_start,
      meter_installation_date, power_purchase_contract,
      technical_review, technical_review_status,
      station_management, urge_order, drawing_change,
      filing_date, construction_status
    ) VALUES (
      deleted_record.original_id, deleted_record.customer_name,
      deleted_record.phone, deleted_record.address, deleted_record.id_card,
      deleted_record.register_date, deleted_record.salesman,
      deleted_record.salesman_phone,
      deleted_record.designer, deleted_record.meter_number,
      deleted_record.capacity, deleted_record.investment_amount,
      deleted_record.land_area, deleted_record.module_count,
      deleted_record.inverter, deleted_record.copper_wire,
      deleted_record.aluminum_wire, deleted_record.distribution_box,
      deleted_record.square_steel_outbound_date, deleted_record.component_outbound_date,
      deleted_record.dispatch_date, deleted_record.construction_team,
      deleted_record.construction_team_phone,
      deleted_record.construction_acceptance_date,
      deleted_record.construction_acceptance_waiting_start,
      deleted_record.meter_installation_date, deleted_record.power_purchase_contract,
      COALESCE(deleted_record.technical_review, ''), -- 确保不为NULL
      deleted_record.technical_review_status,
      deleted_record.station_management, deleted_record.urge_order,
      deleted_record.drawing_change,
      deleted_record.filing_date, deleted_record.construction_status
    );

    -- 将删除记录标记为已恢复
    UPDATE deleted_records
    SET restored_at = NOW(),
        restored_by = NULL
    WHERE id = record_id;

    RETURN '客户已恢复（创建新记录）';
  END IF;
END;
$$;

-- 6. 验证结果
SELECT 'Technical review field fix completed successfully.' AS result; 