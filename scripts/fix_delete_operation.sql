-- 修复客户删除操作和删除记录问题
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '开始修复客户删除操作和删除记录问题...';
END $$;

-- 1. 删除已标记但未生成删除记录的客户的处理
-- 查找已标记为删除但未出现在deleted_records表中的客户
DO $$
DECLARE
    missing_customer RECORD;
BEGIN
    FOR missing_customer IN
        SELECT c.id, c.customer_name, c.deleted_at
        FROM customers c
        WHERE c.deleted_at IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM deleted_records dr
            WHERE dr.original_id = c.id
        )
    LOOP
        RAISE NOTICE '发现已删除但未记录的客户: % (ID: %)', 
            missing_customer.customer_name, missing_customer.id;
            
        -- 手动插入删除记录
        INSERT INTO deleted_records (
            original_id, customer_name, phone, address, id_card, 
            register_date, salesman, salesman_phone, salesman_email,
            surveyor, surveyor_phone, surveyor_email,
            deleted_at, deletion_reason
        )
        SELECT 
            id, customer_name, phone, address, id_card,
            register_date, salesman, salesman_phone, salesman_email,
            surveyor, surveyor_phone, surveyor_email,
            deleted_at, '系统修复生成的删除记录'
        FROM customers 
        WHERE id = missing_customer.id;
        
        RAISE NOTICE '成功为客户 % 创建删除记录', missing_customer.customer_name;
    END LOOP;
END $$;

-- 2. 修复软删除触发器
CREATE OR REPLACE FUNCTION capture_soft_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在删除标记从NULL变为非NULL时触发
  IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    BEGIN
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
        construction_acceptance_date, construction_acceptance_notes,
        technical_review_date, technical_review_notes,
        construction_acceptance_waiting_start,
        meter_installation_date, power_purchase_contract,
        upload_to_grid_date,
        station_management, urge_order, drawing_change,
        filing_date, construction_status, deleted_at,
        deleted_by, deletion_reason, customer_created_at, customer_updated_at
      ) VALUES (
        NEW.id, NEW.customer_name, NEW.phone, NEW.address, NEW.id_card,
        NEW.register_date, NEW.salesman, NEW.salesman_phone, NEW.salesman_email,
        NEW.surveyor, NEW.surveyor_phone, NEW.surveyor_email,
        NEW.designer, NEW.designer_phone, NEW.meter_number,
        NEW.capacity, NEW.investment_amount, NEW.land_area, NEW.module_count,
        NEW.inverter, NEW.copper_wire, NEW.aluminum_wire, NEW.distribution_box,
        NEW.square_steel_outbound_date, NEW.component_outbound_date,
        NEW.dispatch_date, NEW.construction_team, NEW.construction_team_phone,
        NEW.construction_acceptance_date, NEW.construction_acceptance_notes,
        NEW.technical_review_date, NEW.technical_review_notes,
        NEW.construction_acceptance_waiting_start,
        NEW.meter_installation_date, NEW.power_purchase_contract,
        NEW.upload_to_grid_date,
        NEW.station_management, NEW.urge_order, NEW.drawing_change,
        NEW.filing_date, NEW.construction_status, NEW.deleted_at,
        auth.uid(), '软删除', NEW.created_at, NEW.updated_at
      );
      RAISE NOTICE '触发器成功为客户 % 创建删除记录', NEW.customer_name;
      EXCEPTION WHEN OTHERS THEN
        -- 捕获任何错误但不中断操作
        RAISE NOTICE '触发器创建删除记录失败: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建彻底删除客户的新函数
CREATE OR REPLACE FUNCTION complete_delete_customer(customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  customer_rec RECORD;
  success BOOLEAN := false;
  delete_record_id UUID;
BEGIN
  -- 先获取客户信息
  SELECT * INTO customer_rec 
  FROM customers 
  WHERE id = customer_id 
  AND deleted_at IS NULL;
  
  IF customer_rec.id IS NULL THEN
    RAISE NOTICE '客户不存在或已被删除: %', customer_id;
    RETURN false;
  END IF;
  
  -- 手动创建删除记录
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
    station_management, urge_order, drawing_change,
    filing_date, construction_status, deleted_at,
    deleted_by, deletion_reason, customer_created_at, customer_updated_at
  ) 
  SELECT 
    id, customer_name, phone, address, id_card,
    register_date, salesman, salesman_phone, salesman_email,
    surveyor, surveyor_phone, surveyor_email,
    designer, designer_phone, meter_number,
    capacity, investment_amount, land_area, module_count,
    inverter, copper_wire, aluminum_wire, distribution_box,
    square_steel_outbound_date, component_outbound_date,
    dispatch_date, construction_team, construction_team_phone,
    construction_acceptance_date, construction_acceptance_waiting_start,
    meter_installation_date, power_purchase_contract,
    station_management, urge_order, drawing_change,
    filing_date, construction_status, NOW(),
    auth.uid(), '强制删除', created_at, updated_at
  FROM customers
  WHERE id = customer_id
  RETURNING id INTO delete_record_id;
  
  -- 标记客户为已删除
  UPDATE customers 
  SET deleted_at = NOW() 
  WHERE id = customer_id;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  
  IF success THEN
    RAISE NOTICE '客户 % 已成功标记为已删除，删除记录ID: %', 
      customer_rec.customer_name, delete_record_id;
    RETURN true;
  ELSE
    RAISE NOTICE '无法标记客户 % 为已删除', customer_rec.customer_name;
    RETURN false;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- 记录错误信息
  RAISE NOTICE '删除客户 % 时出错: %', customer_id, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 4. 更新客户API使用的删除函数
DROP FUNCTION IF EXISTS safe_delete_customer(uuid);
CREATE OR REPLACE FUNCTION safe_delete_customer(customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 直接调用完整删除函数
  RETURN complete_delete_customer(customer_id);
END;
$$ LANGUAGE plpgsql;

-- 刷新触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
CREATE TRIGGER trigger_capture_soft_deleted_customer
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION complete_delete_customer(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION safe_delete_customer(UUID) TO service_role;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '客户删除操作和删除记录问题修复完成！';
  RAISE NOTICE '使用方法: SELECT complete_delete_customer(''客户ID'')';
END $$;

COMMIT; 