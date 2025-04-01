-- 添加恢复日期相关字段到删除记录表
DO $$
BEGIN
  -- 检查restored_at列是否存在，不存在则添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'restored_at'
  ) THEN
    -- 添加恢复日期列
    ALTER TABLE deleted_records 
    ADD COLUMN restored_at TIMESTAMP WITH TIME ZONE;
    
    RAISE NOTICE '已添加restored_at列到deleted_records表';
  ELSE
    RAISE NOTICE 'restored_at列已存在，无需添加';
  END IF;
  
  -- 检查restored_by列是否存在，不存在则添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'restored_by'
  ) THEN
    -- 添加恢复人员列
    ALTER TABLE deleted_records 
    ADD COLUMN restored_by UUID REFERENCES auth.users(id);
    
    RAISE NOTICE '已添加restored_by列到deleted_records表';
  ELSE
    RAISE NOTICE 'restored_by列已存在，无需添加';
  END IF;
END $$;

-- 更新恢复删除记录函数，记录恢复日期和恢复用户
CREATE OR REPLACE FUNCTION restore_deleted_record(record_id UUID)
RETURNS VOID AS $$
DECLARE
    deleted_record deleted_records;
BEGIN
    -- 获取要恢复的记录
    SELECT * INTO deleted_record 
    FROM deleted_records 
    WHERE id = record_id;
    
    -- 检查记录是否存在
    IF deleted_record.id IS NULL THEN
        RAISE EXCEPTION '删除记录不存在';
    END IF;
    
    -- 检查原始ID的记录是否已经存在
    IF EXISTS (SELECT 1 FROM customers WHERE id = deleted_record.original_id) THEN
        -- 更新已有记录，将deleted_at设为NULL
        UPDATE customers
        SET deleted_at = NULL
        WHERE id = deleted_record.original_id;
    ELSE
        -- 重新创建客户记录
        INSERT INTO customers (
            id, register_date, customer_name, phone, address, id_card,
            salesman, salesman_phone, station_management, filing_date, meter_number,
            designer, drawing_change, urge_order, capacity, investment_amount,
            land_area, module_count, inverter, copper_wire, aluminum_wire,
            distribution_box, square_steel_outbound_date, component_outbound_date,
            dispatch_date, construction_team, construction_team_phone,
            construction_status, main_line, technical_review, upload_to_grid,
            construction_acceptance, meter_installation_date, power_purchase_contract,
            status, price, company, remarks, created_at, updated_at, deleted_at
        )
        VALUES (
            deleted_record.original_id, deleted_record.register_date, deleted_record.customer_name, 
            deleted_record.phone, deleted_record.address, deleted_record.id_card,
            deleted_record.salesman, deleted_record.salesman_phone, deleted_record.station_management, 
            deleted_record.filing_date, deleted_record.meter_number,
            deleted_record.designer, deleted_record.drawing_change, deleted_record.urge_order, 
            deleted_record.capacity, deleted_record.investment_amount,
            deleted_record.land_area, deleted_record.module_count, deleted_record.inverter, 
            deleted_record.copper_wire, deleted_record.aluminum_wire,
            deleted_record.distribution_box, deleted_record.square_steel_outbound_date, 
            deleted_record.component_outbound_date,
            deleted_record.dispatch_date, deleted_record.construction_team, 
            deleted_record.construction_team_phone,
            deleted_record.construction_status, deleted_record.main_line, 
            deleted_record.technical_review, deleted_record.upload_to_grid,
            deleted_record.construction_acceptance, deleted_record.meter_installation_date, 
            deleted_record.power_purchase_contract,
            deleted_record.status, deleted_record.price, deleted_record.company, 
            deleted_record.remarks, deleted_record.customer_created_at, 
            now(), NULL
        );
    END IF;
    
    -- 更新删除记录表中的恢复信息
    UPDATE deleted_records
    SET 
        restored_at = now(),
        restored_by = auth.uid()
    WHERE id = record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予必要的权限
GRANT EXECUTE ON FUNCTION restore_deleted_record(UUID) TO service_role;

-- 为新列创建索引
CREATE INDEX IF NOT EXISTS idx_deleted_records_restored_at ON deleted_records(restored_at);

-- 更新获取已删除记录的函数，仅显示未恢复的记录
CREATE OR REPLACE FUNCTION get_deleted_records()
RETURNS SETOF deleted_records AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM deleted_records
    WHERE restored_at IS NULL
    ORDER BY deleted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取已恢复的记录函数
CREATE OR REPLACE FUNCTION get_restored_records()
RETURNS SETOF deleted_records AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM deleted_records
    WHERE restored_at IS NOT NULL
    ORDER BY restored_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予新函数的权限
GRANT EXECUTE ON FUNCTION get_restored_records() TO service_role; 