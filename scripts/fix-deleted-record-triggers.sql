-- 修复删除记录触发器中的字段名称不匹配问题
BEGIN;

-- 移除旧的触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;

-- 重新创建捕获软删除客户的函数，使用正确的字段名称和类型转换
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
            construction_status, main_line, technical_review_status, upload_to_grid,
            construction_acceptance_status, meter_installation_date, power_purchase_contract,
            status, price, company, remarks, deleted_at, deleted_by, customer_created_at, customer_updated_at
        )
        VALUES (
            NEW.id, 
            NEW.register_date, 
            NEW.customer_name, 
            NEW.phone, 
            NEW.address, 
            NEW.id_card,
            NEW.salesman, 
            NEW.salesman_phone, 
            NEW.station_management, 
            NEW.filing_date::timestamp with time zone, 
            NEW.meter_number,
            NEW.designer, 
            NEW.drawing_change, 
            NEW.urge_order, 
            NEW.capacity, 
            NEW.investment_amount,
            NEW.land_area, 
            NEW.module_count, 
            NEW.inverter, 
            NEW.copper_wire, 
            NEW.aluminum_wire,
            NEW.distribution_box, 
            CASE 
                WHEN NEW.square_steel_outbound_date IS NULL THEN NULL
                WHEN NEW.square_steel_outbound_date::text = 'RETURNED' THEN 'RETURNED'
                ELSE NEW.square_steel_outbound_date::text
            END, 
            CASE 
                WHEN NEW.component_outbound_date IS NULL THEN NULL
                WHEN NEW.component_outbound_date::text = 'RETURNED' THEN 'RETURNED'
                ELSE NEW.component_outbound_date::text
            END,
            NEW.dispatch_date, 
            NEW.construction_team, 
            NEW.construction_team_phone,
            NEW.construction_status, 
            NEW.main_line, 
            NEW.technical_review_status, 
            NEW.upload_to_grid,
            NEW.construction_acceptance_status, 
            NEW.meter_installation_date, 
            NEW.power_purchase_contract,
            NEW.status, 
            NEW.price, 
            NEW.company, 
            NEW.remarks, 
            NEW.deleted_at, 
            auth.uid(), 
            NEW.created_at, 
            NEW.updated_at
        );

        -- 记录删除操作
        RAISE NOTICE '客户 % (ID: %) 已被软删除并记录到deleted_records表', NEW.customer_name, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新创建触发器
CREATE TRIGGER trigger_capture_soft_deleted_customer
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION capture_soft_deleted_customer();

-- 更新物理删除触发器
CREATE OR REPLACE FUNCTION record_deleted_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- 插入到删除记录表
    INSERT INTO deleted_records (
        original_id, register_date, customer_name, phone, address, id_card,
        salesman, salesman_phone, station_management, filing_date, meter_number,
        designer, drawing_change, urge_order, capacity, investment_amount,
        land_area, module_count, inverter, copper_wire, aluminum_wire,
        distribution_box, square_steel_outbound_date, component_outbound_date,
        dispatch_date, construction_team, construction_team_phone,
        construction_status, main_line, technical_review_status, upload_to_grid,
        construction_acceptance_status, meter_installation_date, power_purchase_contract,
        status, price, company, remarks, deleted_at, deleted_by, customer_created_at, customer_updated_at
    )
    VALUES (
        OLD.id, 
        OLD.register_date, 
        OLD.customer_name, 
        OLD.phone, 
        OLD.address, 
        OLD.id_card,
        OLD.salesman, 
        OLD.salesman_phone, 
        OLD.station_management, 
        OLD.filing_date::timestamp with time zone, 
        OLD.meter_number,
        OLD.designer, 
        OLD.drawing_change, 
        OLD.urge_order, 
        OLD.capacity, 
        OLD.investment_amount,
        OLD.land_area, 
        OLD.module_count, 
        OLD.inverter, 
        OLD.copper_wire, 
        OLD.aluminum_wire,
        OLD.distribution_box, 
        CASE 
            WHEN OLD.square_steel_outbound_date IS NULL THEN NULL
            WHEN OLD.square_steel_outbound_date::text = 'RETURNED' THEN 'RETURNED'
            ELSE OLD.square_steel_outbound_date::text
        END, 
        CASE 
            WHEN OLD.component_outbound_date IS NULL THEN NULL
            WHEN OLD.component_outbound_date::text = 'RETURNED' THEN 'RETURNED'
            ELSE OLD.component_outbound_date::text
        END,
        OLD.dispatch_date, 
        OLD.construction_team, 
        OLD.construction_team_phone,
        OLD.construction_status, 
        OLD.main_line, 
        OLD.technical_review_status, 
        OLD.upload_to_grid,
        OLD.construction_acceptance_status, 
        OLD.meter_installation_date, 
        OLD.power_purchase_contract,
        OLD.status, 
        OLD.price, 
        OLD.company, 
        OLD.remarks, 
        COALESCE(OLD.deleted_at, NOW()), 
        auth.uid(), 
        OLD.created_at, 
        OLD.updated_at
    );
    
    -- 记录删除操作
    RAISE NOTICE '客户 % (ID: %) 已被物理删除并记录到deleted_records表', OLD.customer_name, OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建物理删除触发器
CREATE TRIGGER trigger_record_deleted_customer
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION record_deleted_customer();

-- 更新恢复删除记录的函数
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
    
    -- 更新恢复信息
    UPDATE deleted_records
    SET restored_at = NOW(),
        restored_by = auth.uid()
    WHERE id = record_id;
    
    -- 检查原始ID的记录是否已经存在
    IF EXISTS (SELECT 1 FROM customers WHERE id = deleted_record.original_id) THEN
        -- 更新已有记录，将deleted_at设为NULL
        UPDATE customers
        SET deleted_at = NULL,
            updated_at = NOW()
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
            construction_status, main_line, technical_review_status, upload_to_grid,
            construction_acceptance_status, meter_installation_date, power_purchase_contract,
            status, price, company, remarks, created_at, updated_at, deleted_at
        )
        VALUES (
            deleted_record.original_id, 
            deleted_record.register_date, 
            deleted_record.customer_name,
            deleted_record.phone, 
            deleted_record.address, 
            deleted_record.id_card,
            deleted_record.salesman, 
            deleted_record.salesman_phone, 
            deleted_record.station_management,
            deleted_record.filing_date, 
            deleted_record.meter_number,
            deleted_record.designer, 
            deleted_record.drawing_change, 
            deleted_record.urge_order,
            deleted_record.capacity, 
            deleted_record.investment_amount,
            deleted_record.land_area, 
            deleted_record.module_count, 
            deleted_record.inverter,
            deleted_record.copper_wire, 
            deleted_record.aluminum_wire,
            deleted_record.distribution_box, 
            CASE 
                WHEN deleted_record.square_steel_outbound_date IS NULL THEN NULL
                WHEN deleted_record.square_steel_outbound_date = 'RETURNED' THEN 'RETURNED'
                ELSE deleted_record.square_steel_outbound_date
            END,
            CASE 
                WHEN deleted_record.component_outbound_date IS NULL THEN NULL
                WHEN deleted_record.component_outbound_date = 'RETURNED' THEN 'RETURNED'
                ELSE deleted_record.component_outbound_date
            END,
            deleted_record.dispatch_date, 
            deleted_record.construction_team,
            deleted_record.construction_team_phone,
            deleted_record.construction_status, 
            deleted_record.main_line,
            deleted_record.technical_review_status, 
            deleted_record.upload_to_grid,
            deleted_record.construction_acceptance_status, 
            deleted_record.meter_installation_date,
            deleted_record.power_purchase_contract,
            deleted_record.status, 
            deleted_record.price, 
            deleted_record.company,
            deleted_record.remarks, 
            deleted_record.customer_created_at,
            NOW(), 
            NULL
        );
    END IF;
    
    RAISE NOTICE '删除记录 % 已成功恢复', record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新授予权限
GRANT EXECUTE ON FUNCTION capture_soft_deleted_customer() TO service_role;
GRANT EXECUTE ON FUNCTION record_deleted_customer() TO service_role;
GRANT EXECUTE ON FUNCTION restore_deleted_record(UUID) TO service_role;

COMMIT; 