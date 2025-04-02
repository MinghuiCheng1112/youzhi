-- 修复删除记录表结构，添加新的字段以匹配customers表
BEGIN;

-- 先检查字段是否已存在，如果不存在则添加
DO $$
BEGIN
    -- 检查technical_review_status字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'technical_review_status'
    ) THEN
        -- 添加technical_review_status字段
        ALTER TABLE deleted_records ADD COLUMN technical_review_status TEXT;
        RAISE NOTICE 'Added technical_review_status column to deleted_records table';
        
        -- 从technical_review字段更新数据
        UPDATE deleted_records
        SET technical_review_status = 
            CASE 
                WHEN technical_review IS NOT NULL THEN 'approved'
                ELSE 'pending'
            END;
        
        RAISE NOTICE 'Updated technical_review_status values based on existing data';
    ELSE
        RAISE NOTICE 'technical_review_status column already exists in deleted_records table';
    END IF;
    
    -- 检查construction_acceptance_status字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'construction_acceptance_status'
    ) THEN
        -- 添加construction_acceptance_status字段
        ALTER TABLE deleted_records ADD COLUMN construction_acceptance_status TEXT;
        RAISE NOTICE 'Added construction_acceptance_status column to deleted_records table';
        
        -- 从construction_acceptance字段更新数据
        UPDATE deleted_records
        SET construction_acceptance_status = 
            CASE 
                WHEN construction_acceptance IS NOT NULL THEN 'completed'
                ELSE 'pending'
            END;
            
        RAISE NOTICE 'Updated construction_acceptance_status values based on existing data';
    ELSE
        RAISE NOTICE 'construction_acceptance_status column already exists in deleted_records table';
    END IF;
    
    -- 检查construction_acceptance_waiting_days字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'construction_acceptance_waiting_days'
    ) THEN
        -- 添加construction_acceptance_waiting_days字段
        ALTER TABLE deleted_records ADD COLUMN construction_acceptance_waiting_days INTEGER;
        RAISE NOTICE 'Added construction_acceptance_waiting_days column to deleted_records table';
    ELSE
        RAISE NOTICE 'construction_acceptance_waiting_days column already exists in deleted_records table';
    END IF;
    
    -- 检查construction_acceptance_waiting_start字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'construction_acceptance_waiting_start'
    ) THEN
        -- 添加construction_acceptance_waiting_start字段
        ALTER TABLE deleted_records ADD COLUMN construction_acceptance_waiting_start TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added construction_acceptance_waiting_start column to deleted_records table';
    ELSE
        RAISE NOTICE 'construction_acceptance_waiting_start column already exists in deleted_records table';
    END IF;
    
    -- 检查deleted_by字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'deleted_by'
    ) THEN
        -- 添加deleted_by字段
        ALTER TABLE deleted_records ADD COLUMN deleted_by UUID;
        RAISE NOTICE 'Added deleted_by column to deleted_records table';
    ELSE
        RAISE NOTICE 'deleted_by column already exists in deleted_records table';
    END IF;
    
    -- 检查restored_at字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'restored_at'
    ) THEN
        -- 添加restored_at字段
        ALTER TABLE deleted_records ADD COLUMN restored_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added restored_at column to deleted_records table';
    ELSE
        RAISE NOTICE 'restored_at column already exists in deleted_records table';
    END IF;
    
    -- 检查restored_by字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deleted_records' AND column_name = 'restored_by'
    ) THEN
        -- 添加restored_by字段
        ALTER TABLE deleted_records ADD COLUMN restored_by UUID;
        RAISE NOTICE 'Added restored_by column to deleted_records table';
    ELSE
        RAISE NOTICE 'restored_by column already exists in deleted_records table';
    END IF;
END$$;

-- 更新API函数
CREATE OR REPLACE FUNCTION get_deleted_records()
RETURNS SETOF deleted_records AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM deleted_records
    WHERE restored_at IS NULL
    ORDER BY deleted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建获取已恢复记录的API函数
CREATE OR REPLACE FUNCTION get_restored_records()
RETURNS SETOF deleted_records AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM deleted_records
    WHERE restored_at IS NOT NULL
    ORDER BY restored_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新授予权限
GRANT EXECUTE ON FUNCTION get_deleted_records() TO service_role;
GRANT EXECUTE ON FUNCTION get_restored_records() TO service_role;

COMMIT; 