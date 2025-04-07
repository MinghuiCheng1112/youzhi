-- 修复deleted_records表，添加缺失的surveyor相关字段
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '开始检查并修复deleted_records表中缺少的surveyor字段...';
END $$;

-- 添加surveyor字段
DO $$
BEGIN
  -- 检查并添加surveyor字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'surveyor'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN surveyor TEXT;
    RAISE NOTICE '已添加surveyor字段';
  ELSE
    RAISE NOTICE 'surveyor字段已存在';
  END IF;
  
  -- 检查并添加surveyor_phone字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'surveyor_phone'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN surveyor_phone TEXT;
    RAISE NOTICE '已添加surveyor_phone字段';
  ELSE
    RAISE NOTICE 'surveyor_phone字段已存在';
  END IF;
  
  -- 检查并添加surveyor_email字段 (如果还不存在)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'surveyor_email'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN surveyor_email TEXT;
    RAISE NOTICE '已添加surveyor_email字段';
  ELSE
    RAISE NOTICE 'surveyor_email字段已存在';
  END IF;
  
  -- 检查并添加designer_phone字段 (如果还不存在)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'designer_phone'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN designer_phone TEXT;
    RAISE NOTICE '已添加designer_phone字段';
  ELSE
    RAISE NOTICE 'designer_phone字段已存在';
  END IF;
END $$;

-- 修复软删除触发器，确保包含surveyor相关字段
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
      NEW.station_management, NEW.urge_order, NEW.drawing_change,
      NEW.filing_date, NEW.construction_status, NEW.deleted_at,
      auth.uid(), '软删除', NEW.created_at, NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
CREATE TRIGGER trigger_capture_soft_deleted_customer
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE 'deleted_records表字段和触发器修复完成！';
END $$;

COMMIT; 