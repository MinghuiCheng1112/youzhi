-- 专门修复restore_deleted_record函数
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '开始修复restore_deleted_record函数...';
END $$;

-- 删除之前的函数
DROP FUNCTION IF EXISTS restore_deleted_record(UUID);

-- 重新创建restore_deleted_record函数
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

-- 验证函数是否正确创建
DO $$
DECLARE
  has_customer_id_reference BOOLEAN := FALSE;
BEGIN
  -- 检查函数定义中是否有customer_id引用
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE 
      n.nspname = 'public' 
      AND p.proname = 'restore_deleted_record'
      AND pg_get_functiondef(p.oid) LIKE '%customer_id%'
  ) INTO has_customer_id_reference;
  
  IF has_customer_id_reference THEN
    RAISE WARNING '警告: restore_deleted_record函数仍然引用了customer_id';
  ELSE
    RAISE NOTICE '成功: restore_deleted_record函数不再引用customer_id';
  END IF;
END $$;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '修复完成！restore_deleted_record函数已更新';
END $$;

COMMIT; 