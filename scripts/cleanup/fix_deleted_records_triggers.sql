-- 修复deleted_records表相关的触发器
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '开始修复deleted_records表相关的触发器...';
END $$;

-- 1. 删除之前的触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;

-- 2. 删除之前的函数
DROP FUNCTION IF EXISTS capture_soft_deleted_customer();
DROP FUNCTION IF EXISTS record_deleted_customer();

-- 3. 重新创建capture_soft_deleted_customer函数（改用original_id而非customer_id）
CREATE OR REPLACE FUNCTION capture_soft_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在删除标记从NULL变为非NULL时触发
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- 将删除的客户记录到deleted_records表
    INSERT INTO deleted_records (
      original_id, customer_name, phone, address, id_card, 
      register_date, salesman, salesman_phone, salesman_email,
      surveyor, surveyor_phone, surveyor_email,
      designer, designer_phone, meter_number,
      capacity, investment_amount, land_area, module_count,
      inverter, copper_wire, aluminum_wire, distribution_box,
      square_steel_outbound_date, component_outbound_date,
      dispatch_date, construction_team, construction_team_phone,
      construction_acceptance_date, construction_acceptance_waiting_start,
      meter_installation_date, power_purchase_contract,
      first_contact_date, renewal_status_date, interest_status_date,
      upload_to_grid_date, technical_review, technical_review_status,
      station_management, urge_order, drawing_change,
      filing_date, construction_status, deleted_at,
      customer_created_at, deleted_by, deletion_reason
    ) VALUES (
      NEW.id, NEW.customer_name, NEW.phone, NEW.address, NEW.id_card,
      NEW.register_date, NEW.salesman, NEW.salesman_phone, NEW.salesman_email,
      NEW.surveyor, NEW.surveyor_phone, NEW.surveyor_email,
      NEW.designer, NEW.designer_phone, NEW.meter_number,
      NEW.capacity, NEW.investment_amount, NEW.land_area, NEW.module_count,
      NEW.inverter, NEW.copper_wire, NEW.aluminum_wire, NEW.distribution_box,
      NEW.square_steel_outbound_date, NEW.component_outbound_date,
      NEW.dispatch_date, NEW.construction_team, NEW.construction_team_phone,
      NEW.construction_acceptance_date, NEW.construction_acceptance_waiting_start,
      NEW.meter_installation_date, NEW.power_purchase_contract,
      NEW.first_contact_date, NEW.renewal_status_date, NEW.interest_status_date,
      NEW.upload_to_grid_date, NEW.technical_review, NEW.technical_review_status,
      NEW.station_management, NEW.urge_order, NEW.drawing_change,
      NEW.filing_date, NEW.construction_status, NEW.deleted_at,
      NEW.created_at, NULL, '软删除'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 重新创建record_deleted_customer函数（改用original_id而非customer_id）
CREATE OR REPLACE FUNCTION record_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 将物理删除的客户记录保存到deleted_records表
  INSERT INTO deleted_records (
    original_id, customer_name, phone, address, id_card, 
    register_date, salesman, salesman_phone, salesman_email,
    surveyor, surveyor_phone, surveyor_email,
    designer, designer_phone, meter_number,
    capacity, investment_amount, land_area, module_count,
    inverter, copper_wire, aluminum_wire, distribution_box,
    square_steel_outbound_date, component_outbound_date,
    dispatch_date, construction_team, construction_team_phone,
    construction_acceptance_date, construction_acceptance_waiting_start,
    meter_installation_date, power_purchase_contract,
    technical_review, technical_review_status,
    station_management, urge_order, drawing_change,
    filing_date, construction_status, deleted_at,
    customer_created_at, deleted_by, deletion_reason
  ) VALUES (
    OLD.id, OLD.customer_name, OLD.phone, OLD.address, OLD.id_card,
    OLD.register_date, OLD.salesman, OLD.salesman_phone, OLD.salesman_email,
    OLD.surveyor, OLD.surveyor_phone, OLD.surveyor_email,
    OLD.designer, OLD.designer_phone, OLD.meter_number,
    OLD.capacity, OLD.investment_amount, OLD.land_area, OLD.module_count,
    OLD.inverter, OLD.copper_wire, OLD.aluminum_wire, OLD.distribution_box,
    OLD.square_steel_outbound_date, OLD.component_outbound_date,
    OLD.dispatch_date, OLD.construction_team, OLD.construction_team_phone,
    OLD.construction_acceptance_date, OLD.construction_acceptance_waiting_start,
    OLD.meter_installation_date, OLD.power_purchase_contract,
    OLD.technical_review, OLD.technical_review_status,
    OLD.station_management, OLD.urge_order, OLD.drawing_change,
    OLD.filing_date, OLD.construction_status, NOW(),
    OLD.created_at, NULL, '物理删除'
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. 修复restore_deleted_record函数
CREATE OR REPLACE FUNCTION restore_deleted_record(record_id UUID)
RETURNS TEXT AS $$
DECLARE
  customer_exists BOOLEAN;
  deleted_customer RECORD;
BEGIN
  -- 获取要恢复的已删除记录
  SELECT * INTO deleted_customer FROM deleted_records WHERE id = record_id;
  
  IF NOT FOUND THEN
    RETURN '找不到指定的删除记录';
  END IF;
  
  -- 检查客户ID是否已存在（可能已经被重新创建）
  SELECT EXISTS(
    SELECT 1 FROM customers WHERE id = deleted_customer.original_id
  ) INTO customer_exists;
  
  IF customer_exists THEN
    -- 如果客户ID存在，则更新而不是插入
    UPDATE customers SET
      customer_name = deleted_customer.customer_name,
      phone = deleted_customer.phone,
      address = deleted_customer.address,
      id_card = deleted_customer.id_card,
      register_date = deleted_customer.register_date,
      salesman = deleted_customer.salesman,
      salesman_phone = deleted_customer.salesman_phone,
      surveyor = deleted_customer.surveyor,
      surveyor_phone = deleted_customer.surveyor_phone,
      designer = deleted_customer.designer,
      designer_phone = deleted_customer.designer_phone,
      meter_number = deleted_customer.meter_number,
      capacity = deleted_customer.capacity,
      investment_amount = deleted_customer.investment_amount,
      land_area = deleted_customer.land_area,
      module_count = deleted_customer.module_count,
      inverter = deleted_customer.inverter,
      copper_wire = deleted_customer.copper_wire,
      aluminum_wire = deleted_customer.aluminum_wire,
      distribution_box = deleted_customer.distribution_box,
      square_steel_outbound_date = deleted_customer.square_steel_outbound_date,
      component_outbound_date = deleted_customer.component_outbound_date,
      dispatch_date = deleted_customer.dispatch_date,
      construction_team = deleted_customer.construction_team,
      construction_team_phone = deleted_customer.construction_team_phone,
      construction_acceptance_date = deleted_customer.construction_acceptance_date,
      construction_acceptance_waiting_start = deleted_customer.construction_acceptance_waiting_start,
      meter_installation_date = deleted_customer.meter_installation_date,
      power_purchase_contract = deleted_customer.power_purchase_contract,
      technical_review = deleted_customer.technical_review,
      technical_review_status = deleted_customer.technical_review_status,
      station_management = deleted_customer.station_management,
      urge_order = deleted_customer.urge_order,
      drawing_change = deleted_customer.drawing_change,
      filing_date = deleted_customer.filing_date,
      construction_status = deleted_customer.construction_status,
      deleted_at = NULL,
      updated_at = NOW()
    WHERE id = deleted_customer.original_id;
    
    -- 将删除记录标记为已恢复
    UPDATE deleted_records 
    SET restored_at = NOW(), 
        restoration_note = '数据已恢复到现有客户记录' 
    WHERE id = record_id;
    
    RETURN '客户已恢复（通过更新现有记录）';
  ELSE
    -- 如果客户ID不存在，则插入新记录
    INSERT INTO customers (
      id, customer_name, phone, address, id_card, 
      register_date, salesman, salesman_phone,
      surveyor, surveyor_phone,
      designer, designer_phone, meter_number,
      capacity, investment_amount, land_area, module_count,
      inverter, copper_wire, aluminum_wire, distribution_box,
      square_steel_outbound_date, component_outbound_date,
      dispatch_date, construction_team, construction_team_phone,
      construction_acceptance_date, construction_acceptance_waiting_start,
      meter_installation_date, power_purchase_contract,
      technical_review, technical_review_status,
      station_management, urge_order, drawing_change,
      filing_date, construction_status, deleted_at,
      created_at, updated_at
    ) VALUES (
      deleted_customer.original_id, deleted_customer.customer_name, 
      deleted_customer.phone, deleted_customer.address, deleted_customer.id_card,
      deleted_customer.register_date, deleted_customer.salesman, 
      deleted_customer.salesman_phone,
      deleted_customer.surveyor, deleted_customer.surveyor_phone,
      deleted_customer.designer, deleted_customer.designer_phone, 
      deleted_customer.meter_number,
      deleted_customer.capacity, deleted_customer.investment_amount, 
      deleted_customer.land_area, deleted_customer.module_count,
      deleted_customer.inverter, deleted_customer.copper_wire, 
      deleted_customer.aluminum_wire, deleted_customer.distribution_box,
      deleted_customer.square_steel_outbound_date, deleted_customer.component_outbound_date,
      deleted_customer.dispatch_date, deleted_customer.construction_team, 
      deleted_customer.construction_team_phone,
      deleted_customer.construction_acceptance_date, 
      deleted_customer.construction_acceptance_waiting_start,
      deleted_customer.meter_installation_date, deleted_customer.power_purchase_contract,
      deleted_customer.technical_review, 
      deleted_customer.technical_review_status,
      deleted_customer.station_management, deleted_customer.urge_order, 
      deleted_customer.drawing_change,
      deleted_customer.filing_date, deleted_customer.construction_status, 
      NULL,
      deleted_customer.customer_created_at, NOW()
    );
    
    -- 将删除记录标记为已恢复
    UPDATE deleted_records 
    SET restored_at = NOW(), 
        restoration_note = '数据已恢复（创建新记录）' 
    WHERE id = record_id;
    
    RETURN '客户已恢复（创建新记录）';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. 重新创建触发器
CREATE TRIGGER trigger_capture_soft_deleted_customer
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

CREATE TRIGGER trigger_record_deleted_customer
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_deleted_customer();

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '修复完成！deleted_records表相关的触发器已更新';
END $$;

COMMIT; 