-- 自动修复客户删除问题的SQL脚本
-- 此脚本将自动检测并修复所有可能导致客户删除失败的问题
BEGIN;

-- 1. 记录要修复的项目数量
DO $$
DECLARE
    foreign_key_count INT := 0;
    orphaned_record_count INT := 0;
BEGIN
    -- 计算需要修复的外键约束数量
    SELECT COUNT(*) INTO foreign_key_count
    FROM 
        information_schema.table_constraints AS tc 
    JOIN 
        information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN 
        information_schema.constraint_column_usage AS ccu 
        ON ccu.constraint_name = tc.constraint_name
    JOIN
        information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
    WHERE 
        tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'customers'
        AND rc.delete_rule != 'CASCADE';
    
    -- 计算orphaned record数量
    SELECT SUM(orphaned) INTO orphaned_record_count FROM (
        SELECT COUNT(*) AS orphaned
        FROM modification_records mr
        WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = mr.customer_id)
        UNION ALL
        SELECT COUNT(*) AS orphaned
        FROM draw_records dr
        WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = dr.customer_id)
    ) AS counts;

    -- 输出修复计划信息
    RAISE NOTICE '修复计划:';
    RAISE NOTICE '- 需要修复的外键约束: %', foreign_key_count;
    RAISE NOTICE '- 需要清理的孤立记录: %', COALESCE(orphaned_record_count, 0);
END $$;

-- 2. 自动修复所有引用customers表但没有设置ON DELETE CASCADE的外键约束
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- 查询所有需要修复的外键约束
    FOR rec IN (
        SELECT 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
        JOIN 
            information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN 
            information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name
        JOIN
            information_schema.referential_constraints AS rc
            ON rc.constraint_name = tc.constraint_name
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name = 'customers'
            AND rc.delete_rule != 'CASCADE'
    ) LOOP
        -- 输出正在修复的约束
        RAISE NOTICE '修复外键约束: %.% (约束: %)', rec.table_name, rec.column_name, rec.constraint_name;
        
        -- 尝试修复约束
        BEGIN
            -- 动态构建并执行SQL
            EXECUTE 'ALTER TABLE ' || rec.table_name || 
                   ' DROP CONSTRAINT ' || rec.constraint_name;
            
            EXECUTE 'ALTER TABLE ' || rec.table_name ||
                   ' ADD CONSTRAINT ' || rec.constraint_name ||
                   ' FOREIGN KEY (' || rec.column_name || 
                   ') REFERENCES customers(id) ON DELETE CASCADE';
                   
            RAISE NOTICE '  √ 成功修复约束 %', rec.constraint_name;
        EXCEPTION WHEN OTHERS THEN
            -- 记录出错信息
            RAISE WARNING '  ✗ 修复约束 % 时出错: %', rec.constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. 清理孤立的修改记录
DO $$
DECLARE
    orphaned_count INT;
BEGIN
    -- 删除修改记录表中的孤立记录
    DELETE FROM modification_records 
    WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = modification_records.customer_id);
    
    GET DIAGNOSTICS orphaned_count = ROW_COUNT;
    IF orphaned_count > 0 THEN
        RAISE NOTICE '已删除 % 条孤立的修改记录', orphaned_count;
    ELSE
        RAISE NOTICE '没有发现孤立的修改记录';
    END IF;

    -- 删除抽签记录表中的孤立记录
    DELETE FROM draw_records 
    WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = draw_records.customer_id);
    
    GET DIAGNOSTICS orphaned_count = ROW_COUNT;
    IF orphaned_count > 0 THEN
        RAISE NOTICE '已删除 % 条孤立的抽签记录', orphaned_count;
    ELSE
        RAISE NOTICE '没有发现孤立的抽签记录';
    END IF;
END $$;

-- 4. 其他可能潜在的表与customers的孤立关系
DO $$
BEGIN
    -- 尝试检查是否存在其他表可能与customers表关联但没有外键约束
    -- 这种情况可能存在但无法自动修复，仅记录日志
    RAISE NOTICE '系统无法自动检测不存在外键约束的隐式关联，请检查应用代码是否存在硬编码关联';
END $$;

-- 5. 创建辅助函数：安全删除客户
-- 此函数将先尝试软删除，如果成功则返回；如果失败则尝试物理删除
CREATE OR REPLACE FUNCTION safe_delete_customer(customer_id UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- 尝试软删除
    BEGIN
        UPDATE customers 
        SET deleted_at = NOW() 
        WHERE id = customer_id
        AND deleted_at IS NULL;
        
        IF FOUND THEN
            result := '客户已软删除';
        ELSE
            result := '客户不存在或已被删除';
        END IF;
        
        RETURN result;
    EXCEPTION WHEN OTHERS THEN
        -- 软删除失败，记录错误
        result := '软删除失败: ' || SQLERRM;
    END;
    
    -- 如果软删除失败，尝试物理删除
    BEGIN
        -- 先确保删除相关记录
        DELETE FROM modification_records WHERE customer_id = safe_delete_customer.customer_id;
        DELETE FROM draw_records WHERE customer_id = safe_delete_customer.customer_id;
        -- 尝试物理删除客户
        DELETE FROM customers WHERE id = safe_delete_customer.customer_id;
        
        IF FOUND THEN
            result := result || '; 已强制物理删除客户';
        ELSE
            result := result || '; 强制物理删除失败：客户不存在';
        END IF;
        
        RETURN result;
    EXCEPTION WHEN OTHERS THEN
        -- 如果物理删除也失败
        result := result || '; 强制物理删除也失败: ' || SQLERRM;
        RETURN result;
    END;
END;
$$ LANGUAGE plpgsql;

-- 6. 输出修复完成信息
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================';
    RAISE NOTICE '修复工作已完成!';
    RAISE NOTICE '';
    RAISE NOTICE '如果你想删除特定客户，可以使用以下函数:';
    RAISE NOTICE 'SELECT safe_delete_customer(''客户ID'');';
    RAISE NOTICE '';
    RAISE NOTICE '如果你修改了数据库结构，请重新部署触发器:';
    RAISE NOTICE '执行 scripts/cleanup/deploy_dispatch_date_consistency_trigger.sql';
    RAISE NOTICE '==========================';
END $$;

COMMIT; 