-- 修复删除记录表中缺少的字段
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '开始修复deleted_records表中缺少的字段...';
END $$;

-- 1. 添加缺少的字段
DO $$
BEGIN
  -- 检查并添加salesman_email字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'salesman_email'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN salesman_email TEXT;
    RAISE NOTICE '已添加salesman_email字段';
  ELSE
    RAISE NOTICE 'salesman_email字段已存在';
  END IF;
  
  -- 检查并添加surveyor_email字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'surveyor_email'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN surveyor_email TEXT;
    RAISE NOTICE '已添加surveyor_email字段';
  ELSE
    RAISE NOTICE 'surveyor_email字段已存在';
  END IF;
  
  -- 检查并添加designer_phone字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'designer_phone'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN designer_phone TEXT;
    RAISE NOTICE '已添加designer_phone字段';
  ELSE
    RAISE NOTICE 'designer_phone字段已存在';
  END IF;
  
  -- 检查并添加customer_created_at字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'customer_created_at'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN customer_created_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '已添加customer_created_at字段';
  ELSE
    RAISE NOTICE 'customer_created_at字段已存在';
  END IF;
  
  -- 检查并添加customer_updated_at字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'customer_updated_at'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN customer_updated_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '已添加customer_updated_at字段';
  ELSE
    RAISE NOTICE 'customer_updated_at字段已存在';
  END IF;
  
  -- 检查并添加deletion_reason字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'deletion_reason'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN deletion_reason TEXT;
    RAISE NOTICE '已添加deletion_reason字段';
  ELSE
    RAISE NOTICE 'deletion_reason字段已存在';
  END IF;
  
  -- 检查并添加deleted_by字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN deleted_by UUID;
    RAISE NOTICE '已添加deleted_by字段';
  ELSE
    RAISE NOTICE 'deleted_by字段已存在';
  END IF;
END
$$;

-- 2. 修复删除触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;

-- 删除现有的函数
DROP FUNCTION IF EXISTS capture_soft_deleted_customer();
DROP FUNCTION IF EXISTS record_deleted_customer();

-- 创建新的软删除触发器函数
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
      NEW.construction_acceptance_date, NEW.construction_acceptance_waiting_start,
      NEW.meter_installation_date, NEW.power_purchase_contract,
      NEW.first_contact_date, NEW.renewal_status_date, NEW.interest_status_date,
      NEW.upload_to_grid_date, NEW.technical_review, NEW.technical_review_status,
      NEW.station_management, NEW.urge_order, NEW.drawing_change,
      NEW.filing_date, NEW.construction_status, NEW.deleted_at,
      auth.uid(), '软删除', NEW.created_at, NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建新的物理删除触发器函数
CREATE OR REPLACE FUNCTION record_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- 将物理删除的客户记录到deleted_records表
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
    deleted_by, deletion_reason, customer_created_at, customer_updated_at
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
    OLD.first_contact_date, OLD.renewal_status_date, OLD.interest_status_date,
    OLD.upload_to_grid_date, OLD.technical_review, OLD.technical_review_status,
    OLD.station_management, OLD.urge_order, OLD.drawing_change,
    OLD.filing_date, OLD.construction_status, NOW(),
    auth.uid(), '物理删除', OLD.created_at, OLD.updated_at
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器
CREATE TRIGGER trigger_capture_soft_deleted_customer
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

CREATE TRIGGER trigger_record_deleted_customer
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_deleted_customer();

-- 修复删除客户的函数
CREATE OR REPLACE FUNCTION safe_delete_customer(customer_id UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- 检查客户是否存在
  PERFORM id FROM customers WHERE id = customer_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN '客户不存在或已被删除';
  END IF;
  
  -- 尝试软删除
  BEGIN
    UPDATE customers 
    SET deleted_at = NOW() 
    WHERE id = customer_id;
    
    return '客户已成功删除';
  EXCEPTION WHEN OTHERS THEN
    -- 记录错误信息
    result := '删除失败: ' || SQLERRM;
    RETURN result;
  END;
END;
$$ LANGUAGE plpgsql;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '删除记录表字段和触发器修复完成！';
  RAISE NOTICE '如需删除客户，请使用: SELECT safe_delete_customer(''客户ID'');';
END $$;

COMMIT; 