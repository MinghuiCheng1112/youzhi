-- 修复出库日期字段类型不匹配问题
DO $$
BEGIN
  -- 检查customers表中square_steel_outbound_date的数据类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'square_steel_outbound_date'
    AND data_type <> 'timestamp with time zone'
  ) THEN
    -- 修改字段类型为timestamp with time zone
    ALTER TABLE customers 
    ALTER COLUMN square_steel_outbound_date TYPE TIMESTAMP WITH TIME ZONE 
    USING square_steel_outbound_date::TIMESTAMP WITH TIME ZONE;
  END IF;

  -- 检查customers表中component_outbound_date的数据类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'component_outbound_date'
    AND data_type <> 'timestamp with time zone'
  ) THEN
    -- 修改字段类型为timestamp with time zone
    ALTER TABLE customers 
    ALTER COLUMN component_outbound_date TYPE TIMESTAMP WITH TIME ZONE 
    USING component_outbound_date::TIMESTAMP WITH TIME ZONE;
  END IF;

  -- 检查deleted_records表中square_steel_outbound_date的数据类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'square_steel_outbound_date'
    AND data_type <> 'timestamp with time zone'
  ) THEN
    -- 修改字段类型为timestamp with time zone
    ALTER TABLE deleted_records 
    ALTER COLUMN square_steel_outbound_date TYPE TIMESTAMP WITH TIME ZONE 
    USING square_steel_outbound_date::TIMESTAMP WITH TIME ZONE;
  END IF;

  -- 检查deleted_records表中component_outbound_date的数据类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'component_outbound_date'
    AND data_type <> 'timestamp with time zone'
  ) THEN
    -- 修改字段类型为timestamp with time zone
    ALTER TABLE deleted_records 
    ALTER COLUMN component_outbound_date TYPE TIMESTAMP WITH TIME ZONE 
    USING component_outbound_date::TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 修复restore_deleted_record函数以确保类型匹配
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予权限
GRANT EXECUTE ON FUNCTION restore_deleted_record(UUID) TO service_role; 