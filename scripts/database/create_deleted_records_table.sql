-- 创建删除记录表
CREATE TABLE IF NOT EXISTS deleted_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_id UUID NOT NULL, -- 原始客户记录的ID
  register_date TIMESTAMP WITH TIME ZONE,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  id_card TEXT,
  salesman TEXT,
  salesman_phone TEXT,
  station_management TEXT[],
  filing_date TIMESTAMP WITH TIME ZONE,
  meter_number TEXT,
  designer TEXT,
  drawing_change TEXT,
  urge_order TEXT,
  capacity NUMERIC(10, 2),
  investment_amount NUMERIC(10, 2),
  land_area NUMERIC(10, 2),
  module_count INTEGER,
  inverter TEXT,
  copper_wire TEXT,
  aluminum_wire TEXT,
  distribution_box TEXT,
  square_steel_outbound_date TEXT,
  component_outbound_date TEXT,
  dispatch_date TIMESTAMP WITH TIME ZONE,
  construction_team TEXT,
  construction_team_phone TEXT,
  construction_status TEXT,
  main_line TEXT,
  technical_review TEXT,
  upload_to_grid TEXT,
  construction_acceptance TEXT,
  meter_installation_date TIMESTAMP WITH TIME ZONE,
  power_purchase_contract TEXT,
  status TEXT,
  price NUMERIC(10, 2),
  company TEXT,
  remarks TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id),
  customer_created_at TIMESTAMP WITH TIME ZONE,
  customer_updated_at TIMESTAMP WITH TIME ZONE
);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_deleted_records_original_id ON deleted_records(original_id);
CREATE INDEX IF NOT EXISTS idx_deleted_records_customer_name ON deleted_records(customer_name);
CREATE INDEX IF NOT EXISTS idx_deleted_records_phone ON deleted_records(phone);
CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at ON deleted_records(deleted_at);

-- 创建函数：记录删除的客户
CREATE OR REPLACE FUNCTION record_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- 将删除的记录插入到deleted_records表
    INSERT INTO deleted_records (
        original_id, register_date, customer_name, phone, address, id_card,
        salesman, salesman_phone, station_management, filing_date, meter_number,
        designer, drawing_change, urge_order, capacity, investment_amount,
        land_area, module_count, inverter, copper_wire, aluminum_wire,
        distribution_box, square_steel_outbound_date, component_outbound_date,
        dispatch_date, construction_team, construction_team_phone,
        construction_status, main_line, technical_review, upload_to_grid,
        construction_acceptance, meter_installation_date, power_purchase_contract,
        status, price, company, remarks, deleted_by, customer_created_at, customer_updated_at
    )
    VALUES (
        OLD.id, OLD.register_date, OLD.customer_name, OLD.phone, OLD.address, OLD.id_card,
        OLD.salesman, OLD.salesman_phone, OLD.station_management, OLD.filing_date, OLD.meter_number,
        OLD.designer, OLD.drawing_change, OLD.urge_order, OLD.capacity, OLD.investment_amount,
        OLD.land_area, OLD.module_count, OLD.inverter, OLD.copper_wire, OLD.aluminum_wire,
        OLD.distribution_box, OLD.square_steel_outbound_date, OLD.component_outbound_date,
        OLD.dispatch_date, OLD.construction_team, OLD.construction_team_phone,
        OLD.construction_status, OLD.main_line, OLD.technical_review, OLD.upload_to_grid,
        OLD.construction_acceptance, OLD.meter_installation_date, OLD.power_purchase_contract,
        OLD.status, OLD.price, OLD.company, OLD.remarks, auth.uid(), OLD.created_at, OLD.updated_at
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为customers表创建删除触发器
CREATE OR REPLACE TRIGGER trigger_record_deleted_customer
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_deleted_customer();

-- 创建函数：捕获软删除的客户
CREATE OR REPLACE FUNCTION capture_soft_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果deleted_at从NULL变为非NULL，则捕获为删除记录
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        INSERT INTO deleted_records (
            original_id, register_date, customer_name, phone, address, id_card,
            salesman, salesman_phone, station_management, filing_date, meter_number,
            designer, drawing_change, urge_order, capacity, investment_amount,
            land_area, module_count, inverter, copper_wire, aluminum_wire,
            distribution_box, square_steel_outbound_date, component_outbound_date,
            dispatch_date, construction_team, construction_team_phone,
            construction_status, main_line, technical_review, upload_to_grid,
            construction_acceptance, meter_installation_date, power_purchase_contract,
            status, price, company, remarks, deleted_at, deleted_by, customer_created_at, customer_updated_at
        )
        VALUES (
            NEW.id, NEW.register_date, NEW.customer_name, NEW.phone, NEW.address, NEW.id_card,
            NEW.salesman, NEW.salesman_phone, NEW.station_management, NEW.filing_date, NEW.meter_number,
            NEW.designer, NEW.drawing_change, NEW.urge_order, NEW.capacity, NEW.investment_amount,
            NEW.land_area, NEW.module_count, NEW.inverter, NEW.copper_wire, NEW.aluminum_wire,
            NEW.distribution_box, NEW.square_steel_outbound_date, NEW.component_outbound_date,
            NEW.dispatch_date, NEW.construction_team, NEW.construction_team_phone,
            NEW.construction_status, NEW.main_line, NEW.technical_review, NEW.upload_to_grid,
            NEW.construction_acceptance, NEW.meter_installation_date, NEW.power_purchase_contract,
            NEW.status, NEW.price, NEW.company, NEW.remarks, NEW.deleted_at, auth.uid(), NEW.created_at, NEW.updated_at
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为customers表创建软删除触发器
CREATE OR REPLACE TRIGGER trigger_capture_soft_deleted_customer
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

-- 创建API函数：获取所有删除记录
CREATE OR REPLACE FUNCTION get_deleted_records()
RETURNS SETOF deleted_records AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM deleted_records
    ORDER BY deleted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建API函数：恢复删除记录
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
    
    -- 删除已恢复的记录（可选）
    -- DELETE FROM deleted_records WHERE id = record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 将现有软删除的客户迁移到删除记录表
INSERT INTO deleted_records (
    original_id, register_date, customer_name, phone, address, id_card,
    salesman, salesman_phone, station_management, filing_date, meter_number,
    designer, drawing_change, urge_order, capacity, investment_amount,
    land_area, module_count, inverter, copper_wire, aluminum_wire,
    distribution_box, square_steel_outbound_date, component_outbound_date,
    dispatch_date, construction_team, construction_team_phone,
    construction_status, main_line, technical_review, upload_to_grid,
    construction_acceptance, meter_installation_date, power_purchase_contract,
    status, price, company, remarks, deleted_at, customer_created_at, customer_updated_at
)
SELECT 
    id, register_date, customer_name, phone, address, id_card,
    salesman, salesman_phone, station_management, filing_date, meter_number,
    designer, drawing_change, urge_order, capacity, investment_amount,
    land_area, module_count, inverter, copper_wire, aluminum_wire,
    distribution_box, square_steel_outbound_date, component_outbound_date,
    dispatch_date, construction_team, construction_team_phone,
    construction_status, main_line, technical_review, upload_to_grid,
    construction_acceptance, meter_installation_date, power_purchase_contract,
    status, price, company, remarks, deleted_at, created_at, updated_at
FROM customers
WHERE deleted_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM deleted_records WHERE original_id = customers.id);

-- 授予必要的权限
GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_records TO service_role;
GRANT EXECUTE ON FUNCTION get_deleted_records() TO service_role;
GRANT EXECUTE ON FUNCTION restore_deleted_record(UUID) TO service_role; 